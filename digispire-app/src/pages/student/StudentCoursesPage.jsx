import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, ChevronDown, ChevronRight, Check, Award, BookMarked, History, X } from 'lucide-react';

export default function StudentCoursesPage() {
  const { userProfile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [expandedModule, setExpandedModule] = useState(null);
  const [appeals, setAppeals] = useState([]);
  const [revisionModal, setRevisionModal] = useState(null);
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [cSnap, mSnap, tSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'modules')),
        getDocs(collection(db, 'topics')),
      ]);
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTopics(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      if (userProfile?.uid) {
        const appealsSnap = await getDocs(
          query(collection(db, 'revision_appeals'), where('studentUid', '==', userProfile.uid))
        );
        setAppeals(appealsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [userProfile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAll();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  const openRevisionModal = (type, course, mod, topic = null) => {
    setRevisionModal({
      type,
      courseId: course.id,
      courseName: course.name,
      moduleId: mod.id,
      moduleTitle: mod.title,
      topicId: topic?.id || null,
      topicTitle: topic?.title || null,
      notes: ''
    });
  };

  const submitRevisionRequest = async (e) => {
    e.preventDefault();
    if (!revisionModal) return;
    setSubmittingAppeal(true);
    try {
      const appealData = {
        studentUid: userProfile.uid,
        studentId: userProfile.studentId || 'N/A',
        studentName: userProfile.name || 'Anonymous Student',
        studentBatch: userProfile.batchId || 'N/A',
        studentPhotoURL: userProfile.photoURL || '',
        type: revisionModal.type,
        courseId: revisionModal.courseId,
        courseName: revisionModal.courseName,
        moduleId: revisionModal.moduleId,
        moduleTitle: revisionModal.moduleTitle,
        status: 'pending',
        notes: revisionModal.notes,
        createdAt: serverTimestamp()
      };
      if (revisionModal.type === 'topic') {
        appealData.topicId = revisionModal.topicId;
        appealData.topicTitle = revisionModal.topicTitle;
      }
      await addDoc(collection(db, 'revision_appeals'), appealData);
      setRevisionModal(null);
      // Reload appeals
      const appealsSnap = await getDocs(
        query(collection(db, 'revision_appeals'), where('studentUid', '==', userProfile.uid))
      );
      setAppeals(appealsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error submitting revision request: ", err);
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const calcProgress = (courseId) => {
    const courseMods = modules.filter(m => m.courseId === courseId);
    const courseTopics = topics.filter(t => courseMods.some(m => m.id === t.moduleId));
    if (courseTopics.length === 0) return 0;
    const completed = courseTopics.filter(t => t.completedStudents?.includes(userProfile?.uid)).length;
    return Math.round((completed / courseTopics.length) * 100);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#1E3A5F] border-t-transparent" />
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading Academic Syllabus...</p>
    </div>
  );

  return (
    <div className="space-y-5 pb-6 font-sans">
      <div className="section-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Academic Syllabus & Modules</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track topic completions and submit revision requests to faculty</p>
        </div>
        <div className="bg-[#1E3A5F]/10 px-3.5 py-1.5 rounded-lg flex items-center gap-2 self-start sm:self-auto border border-[#1E3A5F]/20">
          <Award size={15} className="text-[#1E3A5F]" />
          <span className="text-xs font-bold text-[#1E3A5F]">Academic Progress</span>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-bold text-sm">No course syllabi published yet.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {courses.map(course => {
            const courseModules = modules.filter(m => m.courseId === course.id);
            const progress = calcProgress(course.id);
            const isExpanded = expandedCourse === course.id;

            return (
              <div key={course.id} className={`bg-white rounded-xl shadow-xs border transition-all ${isExpanded ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/5' : 'border-slate-200'}`}>
                <button
                  className="w-full flex items-center gap-3.5 p-4 sm:p-5 text-left outline-none cursor-pointer"
                  onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors shrink-0 ${isExpanded ? 'bg-[#1E3A5F] text-white' : 'bg-slate-100 text-[#1E3A5F]'}`}>
                    <BookMarked size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${isExpanded ? 'text-[#1E3A5F]' : 'text-slate-800'}`}>{course.name}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-600' : 'bg-[#1E3A5F]'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-600 shrink-0">{progress}%</span>
                    </div>
                  </div>
                  <div className="h-7 w-7 rounded-md bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 sm:px-6 pb-5 pt-1 space-y-2.5 border-t border-slate-100 bg-slate-50/50">
                    {courseModules.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 italic">
                        No modules published for this course yet.
                      </div>
                    ) : (
                      courseModules.map((mod, mIdx) => {
                        const modTopics = topics.filter(t => t.moduleId === mod.id);
                        const isModExpanded = expandedModule === mod.id;
                        const completedCount = modTopics.filter(t => t.completedStudents?.includes(userProfile?.uid)).length;
                        const isModComplete = modTopics.length > 0 && completedCount === modTopics.length;

                        return (
                          <div key={mod.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                            <div
                              className="w-full flex items-center gap-3 p-3.5 cursor-pointer hover:bg-slate-50/70 transition-colors"
                              onClick={() => setExpandedModule(isModExpanded ? null : mod.id)}
                            >
                              <div className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${isModComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                {isModComplete ? <Check size={12} strokeWidth={3} /> : <span className="text-[10px] font-bold">{mIdx + 1}</span>}
                              </div>
                              <span className="text-xs font-bold text-slate-800 flex-1 truncate">{mod.title}</span>
                              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                {isModComplete && (
                                  <>
                                    {(() => {
                                      const modAppeal = appeals.find(a => a.type === 'module' && a.moduleId === mod.id);
                                      if (modAppeal) {
                                        if (modAppeal.status === 'pending') {
                                          return (
                                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                              <History size={10} /> Appeal Pending
                                            </span>
                                          );
                                        }
                                        return (
                                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title={modAppeal.feedback}>
                                            <Check size={10} /> Reviewed
                                          </span>
                                        );
                                      }
                                      return (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openRevisionModal('module', course, mod);
                                          }}
                                          className="text-[10px] font-bold text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white bg-slate-100 px-2 py-0.5 rounded transition border border-slate-200 cursor-pointer"
                                        >
                                          Request Revision
                                        </button>
                                      );
                                    })()}
                                  </>
                                )}
                                <span className="text-[10px] font-mono font-semibold text-slate-400">{completedCount}/{modTopics.length}</span>
                              </div>
                            </div>

                            {isModExpanded && (
                              <div className="p-3 space-y-1.5 border-t border-slate-100 bg-slate-50/40">
                                {modTopics.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic text-center py-2">No lecture topics listed.</p>
                                ) : (
                                  modTopics.map((topic, tIdx) => {
                                    const isDone = topic.completedStudents?.includes(userProfile?.uid);
                                    return (
                                      <div key={topic.id} className="flex items-center justify-between p-2 rounded hover:bg-white transition-colors">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div className={`h-4 w-4 rounded flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`}>
                                            {isDone && <Check size={10} strokeWidth={3} />}
                                          </div>
                                          <span className={`text-xs font-medium truncate ${isDone ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                                            {tIdx + 1}. {topic.title}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Revision Modal */}
      {revisionModal && (
        <div className="modal-backdrop-premium" onClick={() => setRevisionModal(null)}>
          <div className="modal-container-premium max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header-premium">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Submit Academic Revision Appeal</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{revisionModal.courseName} · {revisionModal.moduleTitle}</p>
              </div>
              <button onClick={() => setRevisionModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitRevisionRequest}>
              <div className="modal-body-premium space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Appeal Reason & Clarification Details *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={revisionModal.notes}
                    onChange={e => setRevisionModal({ ...revisionModal, notes: e.target.value })}
                    placeholder="Specify the topics or concepts requiring clarification from the faculty..."
                    className="textarea-premium text-xs"
                  />
                </div>
              </div>

              <div className="modal-footer-premium">
                <button type="button" onClick={() => setRevisionModal(null)} className="btn-outline-premium text-xs py-2">
                  Cancel
                </button>
                <button type="submit" disabled={submittingAppeal} className="btn-primary-premium text-xs py-2">
                  {submittingAppeal ? 'Submitting Appeal...' : 'Submit to Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
