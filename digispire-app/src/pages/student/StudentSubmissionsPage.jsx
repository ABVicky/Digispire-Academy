import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  FolderUp, ExternalLink, Trash2, Clock, CheckCircle, 
  AlertCircle, MessageSquare, Loader2, Link as LinkIcon 
} from 'lucide-react';

export default function StudentSubmissionsPage() {
  const { userProfile } = useAuth();
  const [modules, setModules] = useState([]);
  const [courses, setCourses] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ moduleId: '', link: '', notes: '' });
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text: '' }

  const fetchData = useCallback(async () => {
    if (!userProfile?.uid) return;
    try {
      // 1. Fetch courses and modules to display selection
      const [cSnap, mSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'modules'))
      ]);
      const allCourses = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allModules = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setCourses(allCourses);

      // Filter modules if student has a courseId, otherwise show all
      if (userProfile.courseId) {
        setModules(allModules.filter(m => m.courseId === userProfile.courseId));
      } else {
        setModules(allModules);
      }

      // 2. Fetch past submissions of this student
      const q = query(
        collection(db, 'submissions'),
        where('studentUid', '==', userProfile.uid),
        orderBy('createdAt', 'desc')
      );
      const subSnap = await getDocs(q);
      setSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (err) {
      console.error('Error fetching submission page data:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.moduleId || !form.link) return;
    
    // Simple URL validation
    try {
      new URL(form.link);
    } catch {
      setMessage({ type: 'error', text: 'Please enter a valid URL including http:// or https://' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const selectedModule = modules.find(m => m.id === form.moduleId);
      const selectedCourse = courses.find(c => c.id === (selectedModule?.courseId || userProfile.courseId));

      const submissionPayload = {
        studentUid: userProfile.uid,
        studentName: userProfile.name || 'Student',
        studentId: userProfile.studentId || 'N/A',
        studentPhotoURL: userProfile.photoURL || '',
        courseId: selectedModule?.courseId || userProfile.courseId || 'general',
        courseName: selectedCourse?.name || userProfile.course || 'General Curriculum',
        moduleId: form.moduleId,
        moduleTitle: selectedModule?.title || 'Unknown Module',
        link: form.link.trim(),
        notes: form.notes.trim(),
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'submissions'), submissionPayload);
      
      setForm({ moduleId: '', link: '', notes: '' });
      setMessage({ type: 'success', text: 'Work submitted successfully!' });
      
      // Reload submissions list
      const q = query(
        collection(db, 'submissions'),
        where('studentUid', '==', userProfile.uid),
        orderBy('createdAt', 'desc')
      );
      const subSnap = await getDocs(q);
      setSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error adding submission:', err);
      setMessage({ type: 'error', text: 'Failed to submit work. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) return;
    try {
      await deleteDoc(doc(db, 'submissions', id));
      setSubmissions(submissions.filter(sub => sub.id !== id));
      setMessage({ type: 'success', text: 'Submission removed successfully.' });
    } catch (err) {
      console.error('Error deleting submission:', err);
      setMessage({ type: 'error', text: 'Failed to delete submission.' });
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
      <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Loading submissions console...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Module Submissions</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Submit your doc links, folder links, and project works for educator review.</p>
        </div>
        <div className="h-10 w-10 bg-[#255A84]/15 rounded-xl flex items-center justify-center text-[#255A84] shrink-0">
          <FolderUp size={20} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── Submission Form (Left 5 Cols) ─── */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Submit New Work</h2>
          
          {message && (
            <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2 animate-in fade-in duration-200 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-500 border border-rose-100'
            }`}>
              {message.type === 'success' ? <CheckCircle size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Module *</label>
              {modules.length === 0 ? (
                <p className="text-[11px] text-amber-500 bg-amber-50 p-2.5 rounded-xl border border-amber-100 font-medium">
                  No modules found in your enrolled course curriculum.
                </p>
              ) : (
                <select
                  required
                  value={form.moduleId}
                  onChange={e => setForm({ ...form, moduleId: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#255A84] focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">Choose Module...</option>
                  {modules.map(mod => (
                    <option key={mod.id} value={mod.id}>{mod.title}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Work link *</label>
              <input
                required
                type="url"
                value={form.link}
                onChange={e => setForm({ ...form, link: e.target.value })}
                placeholder="https://docs.google.com/document/... or Google Drive / GitHub"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#255A84] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Remarks / Notes (Optional)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows="4"
                placeholder="Any special remarks or comments for the educator..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#255A84] focus:bg-white transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || modules.length === 0}
              className="w-full py-3.5 bg-[#255A84] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#1c4464] active:scale-[0.98] transition-all shadow-md shadow-[#255A84]/15 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <FolderUp size={14} />}
              {submitting ? 'Submitting...' : 'Submit Work'}
            </button>
          </form>
        </div>

        {/* ─── Submission History (Right 7 Cols) ─── */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Your Submission History</h2>
          
          {submissions.length === 0 ? (
            <div className="text-center py-14 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <LinkIcon size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="text-xs text-slate-400 font-bold">No submissions found</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[250px] mx-auto">Select a module above to submit your first project/doc link.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 no-scrollbar">
              {submissions.map(sub => {
                const dateStr = sub.createdAt ? new Date(sub.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : 'Just now';

                return (
                  <div key={sub.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3 hover:border-slate-200 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-block text-[8px] bg-slate-200/60 text-slate-500 border border-slate-300/40 px-2 py-0.5 rounded font-black tracking-wider uppercase mb-1.5">
                          {sub.courseName}
                        </span>
                        <h3 className="font-extrabold text-slate-800 text-xs truncate">{sub.moduleTitle}</h3>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">Submitted {dateStr}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {sub.status === 'pending' && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Clock size={8} /> Pending
                          </span>
                        )}
                        {sub.status === 'reviewed' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle size={8} /> Reviewed
                          </span>
                        )}
                        {sub.status === 'needs_revision' && (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100 text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle size={8} /> Revision Required
                          </span>
                        )}

                        {sub.status === 'pending' && (
                          <button
                            onClick={() => handleDelete(sub.id)}
                            className="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors"
                            title="Delete Submission"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {sub.notes && (
                      <div className="p-2.5 bg-white rounded-lg border border-slate-100 text-[10px] text-slate-500 leading-normal font-medium">
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[8px] block mb-0.5">Your Remarks</span>
                        {sub.notes}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <a
                        href={sub.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#255A84]/5 hover:bg-[#255A84]/10 text-[#255A84] rounded-lg text-[9px] font-black tracking-wider uppercase transition-all"
                      >
                        <ExternalLink size={10} /> View Link
                      </a>
                    </div>

                    {/* Educator Feedback section */}
                    {(sub.feedback || sub.reviewedBy) && (
                      <div className="p-3 bg-blue-50/40 border border-blue-100/50 rounded-lg space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[9px] text-[#255A84] font-black uppercase tracking-wider">
                          <MessageSquare size={10} />
                          <span>Educator Feedback</span>
                          {sub.reviewedBy && <span className="text-slate-400 font-medium normal-case">by {sub.reviewedBy}</span>}
                        </div>
                        {sub.feedback ? (
                          <p className="text-[10px] text-slate-600 font-medium leading-relaxed">{sub.feedback}</p>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic font-medium">Reviewed with no written remarks.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
