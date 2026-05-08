import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, ChevronDown, ChevronRight, Check, Trophy, BookMarked } from 'lucide-react';

export default function StudentCoursesPage() {
  const { userProfile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [expandedModule, setExpandedModule] = useState(null);

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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleTopic = async (topicId, isCompleted) => {
    if (!userProfile?.uid) return;
    try {
      const topicRef = doc(db, 'topics', topicId);
      await updateDoc(topicRef, {
        completedStudents: isCompleted
          ? arrayRemove(userProfile.uid)
          : arrayUnion(userProfile.uid)
      });
      // Update local state for instant feedback
      setTopics(prev => prev.map(t =>
        t.id === topicId
          ? {
            ...t,
            completedStudents: isCompleted
              ? (t.completedStudents || []).filter(uid => uid !== userProfile.uid)
              : [...(t.completedStudents || []), userProfile.uid]
          }
          : t
      ));
    } catch (err) { console.error('Error toggling topic:', err); }
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
        <div className="text-center py-16 text-slate-400 bg-white rounded-[2rem] border border-dashed border-slate-200">
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
              <div key={course.id} className={`bg-white rounded-[2.5rem] shadow-sm border transition-all duration-300 ${isExpanded ? 'border-[#255A84]/30 ring-4 ring-[#255A84]/5' : 'border-slate-100'}`}>
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
                      <div className="text-center py-8 bg-slate-50 rounded-3xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No modules added yet</p>
                      </div>
                    ) : (
                      courseModules.map(mod => {
                        const modTopics = topics.filter(t => t.moduleId === mod.id);
                        const isModExpanded = expandedModule === mod.id;
                        const completedCount = modTopics.filter(t => t.completedStudents?.includes(userProfile?.uid)).length;
                        const isModComplete = modTopics.length > 0 && completedCount === modTopics.length;

                        return (
                          <div key={mod.id} className="bg-slate-50/50 rounded-3xl border border-slate-100 overflow-hidden">
                            <button
                              className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-100/50 transition-colors"
                              onClick={() => setExpandedModule(isModExpanded ? null : mod.id)}
                            >
                              <div className={`h-6 w-6 rounded-lg flex items-center justify-center transition-colors ${isModComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400'}`}>
                                {isModComplete ? <Check size={12} strokeWidth={3} /> : <BookOpen size={12} />}
                              </div>
                              <span className="text-sm font-bold text-slate-700 flex-1">{mod.title}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400">{completedCount}/{modTopics.length}</span>
                                {isModExpanded ? <ChevronDown size={14} className="text-slate-300" /> : <ChevronRight size={14} className="text-slate-300" />}
                              </div>
                            </button>

                            {isModExpanded && (
                              <div className="p-2 space-y-1">
                                {modTopics.length === 0 ? (
                                  <p className="text-[10px] text-slate-400 text-center py-2 font-bold uppercase tracking-widest">No topics yet</p>
                                ) : modTopics.map(topic => {
                                  const isCompleted = topic.completedStudents?.includes(userProfile?.uid);
                                  return (
                                    <button
                                      key={topic.id}
                                      onClick={() => toggleTopic(topic.id, isCompleted)}
                                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${isCompleted ? 'bg-emerald-50/50' : 'bg-white hover:bg-slate-100/50'}`}
                                    >
                                      <div className={`h-6 w-6 rounded-xl border-2 flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-slate-200 bg-white'}`}>
                                        {isCompleted && <Check size={12} className="text-white" strokeWidth={4} />}
                                      </div>
                                      <span className={`text-sm font-medium transition-colors ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                        {topic.title}
                                      </span>
                                      {isCompleted && <span className="ml-auto text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Completed</span>}
                                    </button>
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
    </div>
  );
}
