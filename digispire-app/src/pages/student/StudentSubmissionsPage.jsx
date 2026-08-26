import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  FolderUp, ExternalLink, Trash2, Clock, CheckCircle2, 
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
      const [cSnap, mSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'modules'))
      ]);
      const allCourses = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allModules = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setCourses(allCourses);

      if (userProfile.courseId) {
        const filtered = allModules.filter(m => m.courseId === userProfile.courseId);
        setModules(filtered.length > 0 ? filtered : allModules);
      } else {
        setModules(allModules);
      }

      const q = query(
        collection(db, 'submissions'),
        where('studentUid', '==', userProfile.uid)
      );
      const subSnap = await getDocs(q);
      const subList = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      subList.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      setSubmissions(subList);

    } catch (err) {
      console.error('Error fetching submissions:', err);
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

    let targetLink = form.link.trim();
    if (!/^https?:\/\//i.test(targetLink)) {
      targetLink = `https://${targetLink}`;
    }
    
    try {
      new URL(targetLink);
    } catch {
      setMessage({ type: 'error', text: 'Please enter a valid web URL (e.g. Google Drive, GitHub repository, or document link).' });
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
        link: targetLink,
        notes: form.notes.trim(),
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'submissions'), submissionPayload);
      
      setForm({ moduleId: '', link: '', notes: '' });
      setMessage({ type: 'success', text: 'Assignment deliverable submitted successfully for faculty review.' });
      
      const q = query(
        collection(db, 'submissions'),
        where('studentUid', '==', userProfile.uid)
      );
      const subSnap = await getDocs(q);
      const subList = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      subList.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      setSubmissions(subList);
    } catch (err) {
      console.error('Error adding submission:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to submit deliverable. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to retract this submission record?')) return;
    try {
      await deleteDoc(doc(db, 'submissions', id));
      setSubmissions(submissions.filter(sub => sub.id !== id));
      setMessage({ type: 'success', text: 'Submission record removed.' });
    } catch (err) {
      console.error('Error deleting submission:', err);
      setMessage({ type: 'error', text: 'Failed to delete submission record.' });
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#1E3A5F] border-t-transparent" />
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading Assignments...</p>
    </div>
  );

  return (
    <div className="space-y-5 pb-8 font-sans">
      {/* ─── Header ─── */}
      <div className="section-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Assignments & Homework</h1>
          <p className="text-xs text-slate-500 mt-0.5">Submit your project links, documents, and code for teacher review</p>
        </div>
        <div className="h-9 w-9 bg-slate-100 rounded-lg flex items-center justify-center text-[#1E3A5F] shrink-0 border border-slate-200">
          <FolderUp size={16} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ─── Submission Form (Left 5 Cols) ─── */}
        <div className="lg:col-span-5 bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Submit an Assignment</h2>
          
          {message && (
            <div className={`p-3 rounded-lg text-xs font-medium flex items-start gap-2.5 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {message.type === 'success' ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
              <span className="leading-tight">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-0.5">
                Select Module <span className="text-rose-500">*</span>
              </label>
              {modules.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  No modules available yet.
                </p>
              ) : (
                <select
                  required
                  value={form.moduleId}
                  onChange={e => setForm({ ...form, moduleId: e.target.value })}
                  className="select-premium cursor-pointer text-xs"
                >
                  <option value="">Choose a module...</option>
                  {modules.map(mod => (
                    <option key={mod.id} value={mod.id}>{mod.title}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-0.5">
                Link to your work <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="url"
                value={form.link}
                onChange={e => setForm({ ...form, link: e.target.value })}
                placeholder="https://github.com/... or Google Drive link"
                className="input-premium text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 ml-0.5">
                Notes or Comments (Optional)
              </label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows="3"
                placeholder="Any comments or instructions for your teacher..."
                className="textarea-premium text-xs resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || modules.length === 0}
              className="w-full py-2.5 bg-[#1E3A5F] hover:bg-[#2B5282] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <FolderUp size={14} />
                  <span>Submit Assignment</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ─── Submission History (Right 7 Cols) ─── */}
        <div className="lg:col-span-7 bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Submission Ledger & Faculty Evaluation</h2>
          
          {submissions.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
              <LinkIcon size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs text-slate-500 font-bold">No Deliverables Submitted</p>
              <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs mx-auto">Select an academic module on the left to submit project work.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {submissions.map(sub => {
                const dateStr = sub.createdAt ? new Date(sub.createdAt.seconds * 1000).toLocaleDateString('en-IN', {
                  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : 'Just now';

                return (
                  <div key={sub.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-block text-[8px] bg-slate-200 text-slate-700 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1">
                          {sub.courseName}
                        </span>
                        <h3 className="font-bold text-slate-800 text-xs truncate">{sub.moduleTitle}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Submitted: {dateStr}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {sub.status === 'pending' && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <Clock size={9} /> Under Review
                          </span>
                        )}
                        {sub.status === 'reviewed' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 size={9} /> Evaluated
                          </span>
                        )}
                        {sub.status === 'needs_revision' && (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle size={9} /> Revision Required
                          </span>
                        )}

                        {sub.status === 'pending' && (
                          <button
                            onClick={() => handleDelete(sub.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Retract Submission"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {sub.notes && (
                      <div className="p-2 bg-white rounded border border-slate-200/60 text-[11px] text-slate-600 leading-normal">
                        <span className="font-bold text-slate-400 uppercase text-[8px] block mb-0.5">Student Remarks:</span>
                        {sub.notes}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-0.5">
                      <a
                        href={sub.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-[#1E3A5F] border border-slate-200 rounded text-[10px] font-semibold transition"
                      >
                        <ExternalLink size={11} /> Open Deliverable URL
                      </a>
                    </div>

                    {/* Faculty Feedback Section */}
                    {(sub.feedback || sub.reviewedBy) && (
                      <div className="p-2.5 bg-blue-50/60 border border-blue-200/80 rounded-lg space-y-1">
                        <div className="flex items-center gap-1.5 text-[9.5px] text-[#1E3A5F] font-bold uppercase tracking-wider">
                          <MessageSquare size={11} />
                          <span>Faculty Evaluation & Remarks</span>
                          {sub.reviewedBy && <span className="text-slate-500 font-normal normal-case">· {sub.reviewedBy}</span>}
                        </div>
                        {sub.feedback ? (
                          <p className="text-xs text-slate-700 font-normal leading-relaxed">{sub.feedback}</p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Evaluated with satisfactory completion.</p>
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
