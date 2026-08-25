import { useEffect, useState } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Plus, ChevronDown, ChevronRight, Trash2, Pencil, X, Check,
  GraduationCap, BookOpen, Layers, CheckCircle2, Sparkles, Folder
} from 'lucide-react';

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [expandedModule, setExpandedModule] = useState(null);
  const [modal, setModal] = useState(null); // {type: 'course'|'module'|'topic', parentId?, editId?, data?}
  const [form, setForm] = useState({ title: '', name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cSnap, mSnap, tSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'modules')),
        getDocs(collection(db, 'topics')),
      ]);
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTopics(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch curriculum:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAll();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const openModal = (type, parentId = null, editItem = null) => {
    setForm(editItem ? { title: editItem.title || '', name: editItem.name || '', description: editItem.description || '' } : { title: '', name: '', description: '' });
    setModal({ type, parentId, editId: editItem?.id });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { type, parentId, editId } = modal;
      if (type === 'course') {
        const data = { name: form.name.trim(), description: form.description.trim() };
        if (editId) await updateDoc(doc(db, 'courses', editId), data);
        else await addDoc(collection(db, 'courses'), { ...data, createdAt: serverTimestamp() });
      } else if (type === 'module') {
        const data = { title: form.title.trim(), courseId: parentId };
        if (editId) await updateDoc(doc(db, 'modules', editId), data);
        else await addDoc(collection(db, 'modules'), { ...data, order: Date.now() });
      } else if (type === 'topic') {
        const data = { title: form.title.trim(), moduleId: parentId, completedStudents: [] };
        if (editId) await updateDoc(doc(db, 'topics', editId), { title: form.title.trim() });
        else await addDoc(collection(db, 'topics'), { ...data, order: Date.now() });
      }
      setModal(null);
      fetchAll();
    } catch (err) { 
      console.error(err); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleDelete = async (colName, id) => {
    if (!window.confirm('Delete this item? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, colName, id));
      fetchAll();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const markTopicComplete = async (topicId, studentId = '__admin__') => {
    const topicRef = doc(db, 'topics', topicId);
    const topic = topics.find(t => t.id === topicId);
    const already = topic.completedStudents?.includes(studentId);
    await updateDoc(topicRef, {
      completedStudents: already
        ? topic.completedStudents.filter(s => s !== studentId)
        : [...(topic.completedStudents || []), studentId]
    });
    fetchAll();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading Curriculum...</p>
    </div>
  );

  return (
    <div className="space-y-6 font-sans pb-8">
      {/* ─── Header ─── */}
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <GraduationCap className="text-[#255A84]" size={26} />
            Course Curriculum
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Structure academy syllabus, modules, and lecture topics</p>
        </div>
        <button 
          onClick={() => openModal('course')} 
          className="btn-primary-premium px-4 py-2.5 shadow-sm text-xs cursor-pointer"
        >
          <Plus size={15} />
          <span>New Course</span>
        </button>
      </div>

      {/* ─── Curriculum Tree ─── */}
      <div className="space-y-4">
        {courses.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-xs space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-blue-50 text-[#255A84] flex items-center justify-center mx-auto">
              <BookOpen size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-700">No Courses Added Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create your first course to begin organizing modules and class topics.
            </p>
            <button onClick={() => openModal('course')} className="btn-primary-premium px-5 py-2.5 text-xs">
              <Plus size={14} /> Add First Course
            </button>
          </div>
        ) : (
          courses.map(course => {
            const courseModules = modules.filter(m => m.courseId === course.id);
            const isExpanded = expandedCourse === course.id;
            const courseTopics = topics.filter(t => courseModules.some(m => m.id === t.moduleId));
            
            return (
              <div key={course.id} className="bg-white rounded-2xl shadow-xs border border-slate-100/90 overflow-hidden transition-all duration-200 hover:border-[#255A84]/20 hover:shadow-md">
                {/* Course Header Bar */}
                <div 
                  className="flex items-center gap-3.5 p-4.5 cursor-pointer select-none bg-white hover:bg-slate-50/60 transition-colors"
                  onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                >
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${isExpanded ? 'bg-[#255A84] text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800 text-base leading-tight truncate">{course.name}</h3>
                      <span className="badge-premium-blue text-[10px]">{courseModules.length} Modules</span>
                      <span className="badge-premium-grey text-[10px]">{courseTopics.length} Topics</span>
                    </div>
                    {course.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{course.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => openModal('module', course.id)} 
                      className="px-2.5 py-1.5 bg-blue-50 text-[#255A84] hover:bg-blue-100 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      title="Add Module"
                    >
                      <Plus size={13} />
                      <span className="hidden sm:inline">Module</span>
                    </button>
                    <button 
                      onClick={() => openModal('course', null, course)} 
                      className="p-2 text-slate-400 hover:text-[#255A84] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                      title="Edit Course"
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete('courses', course.id)} 
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Delete Course"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Modules Nested Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 sm:px-6 pb-5 pt-3 space-y-3 bg-slate-50/40">
                    {courseModules.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                        No modules created for this course. Click "+ Module" above to add one.
                      </div>
                    ) : (
                      courseModules.map((mod, modIdx) => {
                        const modTopics = topics.filter(t => t.moduleId === mod.id);
                        const isModExpanded = expandedModule === mod.id;
                        
                        return (
                          <div key={mod.id} className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                            {/* Module Header */}
                            <div 
                              className="flex items-center gap-2.5 p-3.5 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer transition-colors"
                              onClick={() => setExpandedModule(isModExpanded ? null : mod.id)}
                            >
                              <span className="h-6 w-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-[10px] text-[#255A84] shrink-0">
                                {modIdx + 1}
                              </span>
                              {isModExpanded ? <ChevronDown size={15} className="text-slate-600 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                              <span className="text-sm font-bold text-slate-800 flex-1 truncate">{mod.title}</span>
                              <span className="text-[11px] font-semibold text-slate-400 shrink-0 mr-1">{modTopics.length} topics</span>
                              
                              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                <button 
                                  onClick={() => openModal('topic', mod.id)} 
                                  className="p-1.5 text-slate-400 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title="Add Topic"
                                >
                                  <Plus size={13} />
                                </button>
                                <button 
                                  onClick={() => openModal('module', course.id, mod)} 
                                  className="p-1.5 text-slate-400 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title="Edit Module"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button 
                                  onClick={() => handleDelete('modules', mod.id)} 
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Delete Module"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Topics List */}
                            {isModExpanded && (
                              <div className="p-3 space-y-1.5 bg-white border-t border-slate-100">
                                {modTopics.length === 0 ? (
                                  <p className="text-xs text-slate-400 text-center py-3 italic">
                                    No topics yet. Click the + icon to add topics.
                                  </p>
                                ) : (
                                  modTopics.map((topic, topicIdx) => {
                                    const isDone = topic.completedStudents?.includes('__admin__');
                                    return (
                                      <div 
                                        key={topic.id} 
                                        className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
                                      >
                                        <button
                                          onClick={() => markTopicComplete(topic.id)}
                                          className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                            isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-[#255A84]'
                                          }`}
                                          title={isDone ? 'Marked complete' : 'Mark as complete'}
                                        >
                                          {isDone && <Check size={12} strokeWidth={3} />}
                                        </button>
                                        <span className={`text-xs font-medium flex-1 ${isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                          {topicIdx + 1}. {topic.title}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button 
                                            onClick={() => openModal('topic', mod.id, topic)} 
                                            className="p-1 text-slate-400 hover:text-[#255A84] rounded transition cursor-pointer"
                                            title="Edit Topic"
                                          >
                                            <Pencil size={12} />
                                          </button>
                                          <button 
                                            onClick={() => handleDelete('topics', topic.id)} 
                                            className="p-1 text-slate-400 hover:text-rose-500 rounded transition cursor-pointer"
                                            title="Delete Topic"
                                          >
                                            <Trash2 size={12} />
                                          </button>
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
          })
        )}
      </div>

      {/* ─── Modal ─── */}
      {modal && (
        <div className="modal-backdrop-premium" onClick={() => setModal(null)}>
          <div className="modal-container-premium max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header-premium">
              <div>
                <h2 className="text-base font-bold text-slate-800 capitalize">
                  {modal.editId ? 'Edit' : 'Add New'} {modal.type}
                </h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Curriculum Architecture
                </p>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
              <div className="modal-body-premium space-y-4">
                {modal.type === 'course' ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                        Course Name <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        required 
                        value={form.name} 
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="input-premium" 
                        placeholder="e.g. Full-Stack Web Development" 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                        Course Description
                      </label>
                      <textarea 
                        value={form.description} 
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        className="textarea-premium" 
                        rows={3} 
                        placeholder="Overview of syllabus, modules, and target learning outcomes..." 
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      {modal.type === 'module' ? 'Module' : 'Topic'} Title <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      required 
                      value={form.title} 
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="input-premium"
                      placeholder={modal.type === 'module' ? 'e.g. HTML5 & Semantic Web' : 'e.g. Semantic Tags & SEO Optimization'} 
                    />
                  </div>
                )}
              </div>
              
              <div className="modal-footer-premium">
                <button 
                  type="button" 
                  onClick={() => setModal(null)} 
                  className="btn-outline-premium flex-1 py-2.5 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="btn-primary-premium flex-1 py-2.5 text-xs"
                >
                  {saving ? 'Saving...' : modal.editId ? 'Update Item' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
