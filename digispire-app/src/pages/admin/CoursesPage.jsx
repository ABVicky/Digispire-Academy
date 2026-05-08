import { useEffect, useState } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Plus, ChevronDown, ChevronRight, Trash2, Pencil, X, Check } from 'lucide-react';

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
    const [cSnap, mSnap, tSnap] = await Promise.all([
      getDocs(collection(db, 'courses')),
      getDocs(collection(db, 'modules')),
      getDocs(collection(db, 'topics')),
    ]);
    setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setTopics(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

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
        const data = { name: form.name, description: form.description };
        if (editId) await updateDoc(doc(db, 'courses', editId), data);
        else await addDoc(collection(db, 'courses'), { ...data, createdAt: serverTimestamp() });
      } else if (type === 'module') {
        const data = { title: form.title, courseId: parentId };
        if (editId) await updateDoc(doc(db, 'modules', editId), data);
        else await addDoc(collection(db, 'modules'), { ...data, order: Date.now() });
      } else if (type === 'topic') {
        const data = { title: form.title, moduleId: parentId, completedStudents: [] };
        if (editId) await updateDoc(doc(db, 'topics', editId), { title: form.title });
        else await addDoc(collection(db, 'topics'), { ...data, order: Date.now() });
      }
      setModal(null);
      fetchAll();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (colName, id) => {
    if (!window.confirm('Delete this item?')) return;
    await deleteDoc(doc(db, colName, id));
    fetchAll();
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

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Courses</h1>
          <p className="text-sm text-slate-500">Manage courses, modules, and topics</p>
        </div>
        <button onClick={() => openModal('course')} className="flex items-center gap-2 bg-[#255A84] hover:bg-[#1a4261] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition">
          <Plus size={16} /> New Course
        </button>
      </div>

      <div className="space-y-3">
        {courses.length === 0 && <p className="text-center text-slate-400 py-12">No courses yet. Add your first course!</p>}
        {courses.map(course => {
          const courseModules = modules.filter(m => m.courseId === course.id);
          const isExpanded = expandedCourse === course.id;
          return (
            <div key={course.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedCourse(isExpanded ? null : course.id)}>
                {isExpanded ? <ChevronDown size={18} className="text-[#255A84]" /> : <ChevronRight size={18} className="text-slate-400" />}
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{course.name}</p>
                  <p className="text-xs text-slate-400">{courseModules.length} modules</p>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openModal('module', course.id)} className="p-1.5 text-slate-400 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition"><Plus size={14} /></button>
                  <button onClick={() => openModal('course', null, course)} className="p-1.5 text-slate-400 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete('courses', course.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={14} /></button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-50 px-4 pb-4 pt-2 space-y-2">
                  {courseModules.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">No modules yet. Add a module above.</p>}
                  {courseModules.map(mod => {
                    const modTopics = topics.filter(t => t.moduleId === mod.id);
                    const isModExpanded = expandedModule === mod.id;
                    return (
                      <div key={mod.id} className="border border-slate-100 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 p-3 bg-slate-50 cursor-pointer" onClick={() => setExpandedModule(isModExpanded ? null : mod.id)}>
                          {isModExpanded ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-400" />}
                          <span className="text-sm font-medium text-slate-700 flex-1">{mod.title}</span>
                          <span className="text-xs text-slate-400">{modTopics.length} topics</span>
                          <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openModal('topic', mod.id)} className="p-1 text-slate-400 hover:text-[#255A84]"><Plus size={13} /></button>
                            <button onClick={() => openModal('module', course.id, mod)} className="p-1 text-slate-400 hover:text-[#255A84]"><Pencil size={13} /></button>
                            <button onClick={() => handleDelete('modules', mod.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                          </div>
                        </div>
                        {isModExpanded && (
                          <div className="p-3 space-y-1.5">
                            {modTopics.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No topics. Add topics above.</p>}
                            {modTopics.map(topic => (
                              <div key={topic.id} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-slate-50">
                                <button
                                  onClick={() => markTopicComplete(topic.id)}
                                  className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${topic.completedStudents?.includes('__admin__') ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}
                                >
                                  {topic.completedStudents?.includes('__admin__') && <Check size={11} className="text-white" />}
                                </button>
                                <span className="text-sm text-slate-700 flex-1">{topic.title}</span>
                                <span className="text-xs text-slate-400">{topic.completedStudents?.length || 0} done</span>
                                <button onClick={() => openModal('topic', mod.id, topic)} className="p-1 text-slate-400 hover:text-[#255A84]"><Pencil size={12} /></button>
                                <button onClick={() => handleDelete('topics', topic.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 capitalize">{modal.editId ? 'Edit' : 'Add'} {modal.type}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {modal.type === 'course' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Course Name *</label>
                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84]" placeholder="e.g. Web Development" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84] resize-none" rows={3} placeholder="Course description..." />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{modal.type === 'module' ? 'Module' : 'Topic'} Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84]"
                    placeholder={modal.type === 'module' ? 'e.g. HTML Basics' : 'e.g. What is HTML?'} />
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#255A84] hover:bg-[#1a4261] text-white rounded-xl text-sm font-semibold transition disabled:opacity-60">
                  {saving ? 'Saving...' : modal.editId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
