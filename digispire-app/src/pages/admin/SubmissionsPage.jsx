import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  FolderOpen, Check, Trash2, X, MessageSquare, Search,
  CheckCircle2, Clock, AlertCircle, ExternalLink, Loader2
} from 'lucide-react';

export default function SubmissionsPage() {
  const { userProfile } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'reviewed', 'needs_revision'
  const [search, setSearch] = useState('');
  const [reviewModal, setReviewModal] = useState(null); // submission doc to review
  const [feedback, setFeedback] = useState('');
  const [statusVal, setStatusVal] = useState('reviewed'); // 'reviewed', 'needs_revision'
  const [processing, setProcessing] = useState(false);

  const fetchSubmissions = async () => {
    try {
      const q = query(collection(db, 'submissions'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSubmissions();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleReview = async (e) => {
    e.preventDefault();
    if (!reviewModal) return;
    setProcessing(true);
    try {
      const subRef = doc(db, 'submissions', reviewModal.id);
      await updateDoc(subRef, {
        status: statusVal,
        feedback: feedback.trim(),
        reviewedAt: serverTimestamp(),
        reviewedBy: userProfile?.name || 'Educator'
      });
      setReviewModal(null);
      setFeedback('');
      fetchSubmissions();
    } catch (err) {
      console.error("Error updating submission:", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this submission record?")) return;
    try {
      await deleteDoc(doc(db, 'submissions', id));
      fetchSubmissions();
    } catch (err) {
      console.error("Error deleting submission:", err);
    }
  };

  const openReviewDialog = (sub) => {
    setReviewModal(sub);
    setFeedback(sub.feedback || '');
    setStatusVal(sub.status === 'needs_revision' ? 'needs_revision' : 'reviewed');
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesFilter = 
      filter === 'all' || 
      (filter === 'pending' && sub.status === 'pending') || 
      (filter === 'reviewed' && sub.status === 'reviewed') ||
      (filter === 'needs_revision' && sub.status === 'needs_revision');

    const searchStr = `${sub.studentName} ${sub.studentId} ${sub.courseName} ${sub.moduleTitle}`.toLowerCase();
    const matchesSearch = searchStr.includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const reviewedCount = submissions.filter(s => s.status === 'reviewed').length;
  const revisionCount = submissions.filter(s => s.status === 'needs_revision').length;

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
      <p className="text-xs text-slate-400 font-medium">Loading submissions...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ─── Header ─── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Student Submissions</h1>
        <p className="text-sm text-slate-500 mt-0.5">Evaluate and review submitted document or folder links from students by modules</p>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-10 w-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
            <FolderOpen size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800 leading-none">{submissions.length}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Total Received</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800 leading-none">{pendingCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 font-sans">Pending Action</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800 leading-none">{reviewedCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Reviewed</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800 leading-none">{revisionCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Revisions Req.</p>
          </div>
        </div>
      </div>

      {/* ─── Search and Filters ─── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex bg-slate-50 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: `Pending (${pendingCount})` },
            { id: 'reviewed', label: `Reviewed (${reviewedCount})` },
            { id: 'needs_revision', label: `Revision Required (${revisionCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 whitespace-nowrap ${filter === tab.id ? 'bg-white text-[#255A84] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student or module..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#255A84] focus:bg-white transition-all font-medium"
          />
        </div>
      </div>

      {/* ─── Submissions List ─── */}
      {filteredSubmissions.length === 0 ? (
        <div className="bg-white rounded-2xl py-20 text-center border border-slate-100">
          <FolderOpen size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400 font-bold text-sm">No submissions match the filters</p>
          <p className="text-slate-400 text-[11px] mt-1">Check back later or adjust filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSubmissions.map(sub => {
            const dateStr = sub.createdAt ? new Date(sub.createdAt.seconds * 1000).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Just now';

            return (
              <div key={sub.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition group">
                <div className="space-y-4">
                  {/* Student profile block */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#255A84] text-white flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
                        {sub.studentPhotoURL ? (
                          <img src={sub.studentPhotoURL} alt={sub.studentName} className="h-full w-full object-cover" />
                        ) : (
                          <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1 bg-white" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-800 text-xs truncate leading-snug">{sub.studentName}</h3>
                        <p className="text-[9px] font-mono font-bold text-slate-400">ID: {sub.studentId}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition rounded"
                      title="Delete Submissions"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Course / Module Details */}
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] bg-slate-200/60 text-slate-500 border border-slate-300/40 px-2 py-0.5 rounded font-black tracking-wider uppercase">
                        {sub.courseName}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">{dateStr}</span>
                    </div>
                    <h4 className="font-bold text-slate-700 text-xs mt-1 truncate">{sub.moduleTitle}</h4>
                  </div>

                  {/* Student Remarks */}
                  {sub.notes && (
                    <div className="text-[11px] text-slate-500 leading-normal font-medium pl-1 border-l-2 border-slate-200">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Student Notes</span>
                      {sub.notes}
                    </div>
                  )}

                  {/* Review feedback if resolved */}
                  {(sub.status !== 'pending' || sub.feedback) && (
                    <div className={`p-3 rounded-xl border space-y-1.5 ${
                      sub.status === 'needs_revision' ? 'bg-rose-50/40 border-rose-100/50' : 'bg-emerald-50/40 border-emerald-100/50'
                    }`}>
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          <MessageSquare size={10} className={sub.status === 'needs_revision' ? 'text-rose-500' : 'text-emerald-500'} />
                          <span className={sub.status === 'needs_revision' ? 'text-rose-600' : 'text-emerald-600'}>
                            {sub.status === 'needs_revision' ? 'Revision Requested' : 'Feedback / Reviewed'}
                          </span>
                        </div>
                        {sub.reviewedBy && <span className="text-slate-400 font-medium normal-case">by {sub.reviewedBy}</span>}
                      </div>
                      {sub.feedback ? (
                        <p className="text-[10px] text-slate-600 font-medium leading-relaxed">{sub.feedback}</p>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic font-medium">No remarks provided.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer URL link & Actions */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <a
                    href={sub.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 bg-[#255A84]/5 hover:bg-[#255A84]/10 text-[#255A84] rounded-xl text-[9px] font-black tracking-wider uppercase transition-all"
                  >
                    <ExternalLink size={11} /> Open Link
                  </a>

                  <button
                    onClick={() => openReviewDialog(sub)}
                    className={`px-3.5 py-2 rounded-xl text-[9px] font-black tracking-wider uppercase transition-all flex items-center gap-1 ${
                      sub.status === 'pending'
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {sub.status === 'pending' ? 'Review Submission' : 'Update Review'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Review Submission Dialog Modal ─── */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Review Student Work</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Evaluate {reviewModal.studentName}'s link</p>
              </div>
              <button
                onClick={() => setReviewModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReview} className="space-y-4 font-sans">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Review Outcome *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusVal('reviewed')}
                    className={`flex items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${
                      statusVal === 'reviewed'
                        ? 'bg-emerald-500 border-transparent text-white font-bold shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Approve / Reviewed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusVal('needs_revision')}
                    className={`flex items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${
                      statusVal === 'needs_revision'
                        ? 'bg-rose-500 border-transparent text-white font-bold shadow-lg shadow-rose-500/10'
                        : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <AlertCircle size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Req. Revision</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Feedback / Remarks</label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows="4"
                  placeholder="Provide feedback on the work submitted, changes required, or guidance..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#255A84] focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModal(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 py-3 bg-[#255A84] hover:bg-[#1c4464] text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-[#255A84]/15 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {processing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
