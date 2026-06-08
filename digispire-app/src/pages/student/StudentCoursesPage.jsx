import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, ChevronDown, ChevronRight, Check, Trophy, BookMarked, History, X } from 'lucide-react';

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

  const fetchAll = async () => {
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
  };

  useEffect(() => {
    fetchAll();
  }, [userProfile?.uid]);

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
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
      <p className="text-xs text-slate-400 font-medium">Loading your curriculum...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Curriculum</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">Track your learning progress</p>
        </div>
        <div className="bg-[#255A84]/10 px-4 py-2 rounded-2xl flex items-center gap-2">
          <Trophy size={16} className="text-[#255A84]" />
          <span className="text-xs font-bold text-[#255A84]">Level Up</span>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
          <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-bold">No courses available yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map(course => {
            const courseModules = modules.filter(m => m.courseId === course.id);
            const progress = calcProgress(course.id);
            const isExpanded = expandedCourse === course.id;

            return (
              <div key={course.id} className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 ${isExpanded ? 'border-[#255A84]/30 ring-4 ring-[#255A84]/5' : 'border-slate-100'}`}>
                <button
                  className="w-full flex items-center gap-4 p-5 text-left outline-none"
                  onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                >
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors ${isExpanded ? 'bg-[#255A84] text-white' : 'bg-slate-50 text-[#255A84]'}`}>
                    <BookMarked size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm transition-colors ${isExpanded ? 'text-[#255A84]' : 'text-slate-800'}`}>{course.name}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-700 ${progress === 100 ? 'bg-emerald-500' : 'bg-[#F48B1F]'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold tracking-widest ${progress === 100 ? 'text-emerald-600' : 'text-slate-500'}`}>{progress}%</span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 space-y-3 animate-in slide-in-from-top-2 duration-300">
                    {courseModules.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No modules added yet</p>
                      </div>
                    ) : (
                      courseModules.map(mod => {
                        const modTopics = topics.filter(t => t.moduleId === mod.id);
                        const isModExpanded = expandedModule === mod.id;
                        const completedCount = modTopics.filter(t => t.completedStudents?.includes(userProfile?.uid)).length;
                        const isModComplete = modTopics.length > 0 && completedCount === modTopics.length;

                        return (
                          <div key={mod.id} className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden">
                            <div
                              className="w-full flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-100/50 transition-colors"
                              onClick={() => setExpandedModule(isModExpanded ? null : mod.id)}
                            >
                              <div className={`h-6 w-6 rounded-lg flex items-center justify-center transition-colors ${isModComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400'}`}>
                                {isModComplete ? <Check size={12} strokeWidth={3} /> : <BookOpen size={12} />}
                              </div>
                              <span className="text-sm font-bold text-slate-700 flex-1">{mod.title}</span>
                              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                {isModComplete && (
                                  <>
                                    {(() => {
                                      const modAppeal = appeals.find(a => a.type === 'module' && a.moduleId === mod.id);
                                      if (modAppeal) {
                                        if (modAppeal.status === 'pending') {
                                          return (
                                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-sm border border-amber-100 animate-pulse">
                                              <History size={10} /> Revision Pending
                                            </span>
                                          );
                                        }
                                        return (
                                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl flex items-center gap-1 border border-slate-200" title={modAppeal.feedback}>
                                            <Check size={10} /> Revision Done
                                          </span>
                                        );
                                      }
                                      return (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openRevisionModal('module', course, mod);
                                          }}
                                          className="text-[10px] font-bold text-[#F48B1F] hover:text-white bg-[#F48B1F]/10 hover:bg-[#F48B1F] px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 active:scale-95 border border-[#F48B1F]/20"
                                        >
                                          <History size={10} /> Request Revision
                                        </button>
                                      );
                                    })()}
                                  </>
                                )}
                                <span className="text-[10px] font-bold text-slate-400">{completedCount}/{modTopics.length}</span>
                                <div onClick={() => setExpandedModule(isModExpanded ? null : mod.id)} className="cursor-pointer p-1">
                                  {isModExpanded ? <ChevronDown size={14} className="text-slate-300" /> : <ChevronRight size={14} className="text-slate-300" />}
                                </div>
                              </div>
                            </div>

                            {isModExpanded && (
                              <div className="p-2 space-y-1">
                                {modTopics.length === 0 ? (
                                  <p className="text-[10px] text-slate-400 text-center py-2 font-bold uppercase tracking-widest">No topics yet</p>
                                ) : modTopics.map(topic => {
                                  const isCompleted = topic.completedStudents?.includes(userProfile?.uid);
                                  return (
                                    <div
                                      key={topic.id}
                                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all cursor-default ${isCompleted ? 'bg-emerald-50/50' : 'bg-white border border-slate-50'}`}
                                    >
                                      <div className={`h-6 w-6 rounded-xl border-2 flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-slate-200 bg-slate-50'}`}>
                                        {isCompleted && <Check size={12} className="text-white" strokeWidth={4} />}
                                      </div>
                                      <span className={`text-sm font-medium transition-colors ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                        {topic.title}
                                      </span>
                                      {isCompleted && (
                                        <div className="ml-auto flex items-center gap-2 shrink-0">
                                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hidden sm:inline-block">Completed</span>
                                          {(() => {
                                            const topicAppeal = appeals.find(a => a.type === 'topic' && a.topicId === topic.id);
                                            if (topicAppeal) {
                                              if (topicAppeal.status === 'pending') {
                                                return (
                                                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-sm border border-amber-100">
                                                    <History size={10} /> Revision Pending
                                                  </span>
                                                );
                                              }
                                              return (
                                                <div className="flex flex-col items-end">
                                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl flex items-center gap-1 border border-slate-200" title={topicAppeal.feedback ? `Feedback: ${topicAppeal.feedback}` : undefined}>
                                                    <Check size={10} /> Revision Done
                                                  </span>
                                                  {topicAppeal.feedback && (
                                                    <span className="text-[8px] text-slate-400 mt-0.5 max-w-[100px] truncate">{topicAppeal.feedback}</span>
                                                  )}
                                                </div>
                                              );
                                            }
                                            return (
                                              <button
                                                onClick={() => openRevisionModal('topic', course, mod, topic)}
                                                className="text-[10px] font-bold text-[#255A84] hover:text-white bg-[#255A84]/5 hover:bg-[#255A84] px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 active:scale-95 border border-[#255A84]/10"
                                              >
                                                <History size={10} /> Request Revision
                                              </button>
                                            );
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
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

      {/* Revision Request Modal */}
      {revisionModal && (
        <div className="modal-backdrop-premium" onClick={() => setRevisionModal(null)}>
          <div className="modal-container-premium max-w-md animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="modal-header-premium">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Request Revision</h3>
                <p className="text-[10px] font-bold text-[#255A84] uppercase tracking-wider mt-0.5 font-sans">
                  {revisionModal.type === 'module' ? 'Module Revision' : 'Topic Revision'}
                </p>
              </div>
              <button
                onClick={() => setRevisionModal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitRevisionRequest} className="flex flex-col h-full overflow-hidden">
              <div className="modal-body-premium space-y-4">
                <div className="bg-[#255A84]/5 rounded-2xl p-4 border border-[#255A84]/10 space-y-1.5 text-xs text-slate-600">
                  <p><span className="font-bold text-slate-800">Course:</span> {revisionModal.courseName}</p>
                  <p><span className="font-bold text-slate-800">Module:</span> {revisionModal.moduleTitle}</p>
                  {revisionModal.type === 'topic' && (
                    <p><span className="font-bold text-slate-800">Topic:</span> {revisionModal.topicTitle}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Revision Notes / What would you like to revise?
                  </label>
                  <textarea
                    value={revisionModal.notes}
                    onChange={e => setRevisionModal(m => ({ ...m, notes: e.target.value }))}
                    className="textarea-premium"
                    rows={4}
                    placeholder="Explain your doubts or what topics you want to go over..."
                  />
                </div>
              </div>

              <div className="modal-footer-premium">
                <button
                  type="button"
                  onClick={() => setRevisionModal(null)}
                  className="btn-outline-premium flex-1 py-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAppeal}
                  className="btn-primary-premium flex-1 py-3"
                >
                  {submittingAppeal ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
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
