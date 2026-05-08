import { useEffect, useState } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Plus, Link2, FileText, Globe, Trash2, Pencil, X,
  ExternalLink, Search, Filter, BookOpen
} from 'lucide-react';

// Detect link type from URL
function detectType(url) {
  if (!url) return 'link';
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) return 'gdrive';
  if (lower.includes('.pdf') || lower.includes('pdf')) return 'pdf';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'video';
  return 'link';
}

function typeLabel(type) {
  const map = { pdf: 'PDF', gdrive: 'Google Drive', video: 'Video', link: 'Link' };
  return map[type] || 'Link';
}

function typeBadge(type) {
  const map = {
    pdf: 'bg-red-50 text-red-600',
    gdrive: 'bg-blue-50 text-blue-600',
    video: 'bg-purple-50 text-purple-700',
    link: 'bg-slate-100 text-slate-600',
  };
  return map[type] || map.link;
}

function TypeIcon({ type, size = 18 }) {
  if (type === 'pdf') return <FileText size={size} className="text-red-500" />;
  if (type === 'gdrive') return <img src="https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png" className="w-5 h-5 object-contain" alt="" />;
  if (type === 'video') return <Globe size={size} className="text-purple-500" />;
  return <Link2 size={size} className="text-blue-500" />;
}

function isValidUrl(url) {
  try { new URL(url); return true; } catch { return false; }
}

const emptyForm = { title: '', description: '', url: '', courseId: '', subject: '' };

export default function ContentPage() {
  const [contents, setContents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [urlError, setUrlError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cSnap, contentSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'content')),
      ]);
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const items = contentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setContents(items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setUrlError('');
    setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({
      title: item.title || '',
      description: item.description || '',
      url: item.fileUrl || item.url || '',
      courseId: item.courseId || '',
      subject: item.subject || '',
    });
    setEditingId(item.id);
    setUrlError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setUrlError('');
    if (!form.url.trim()) { setUrlError('URL is required.'); return; }
    if (!isValidUrl(form.url.trim())) { setUrlError('Please enter a valid URL (e.g. https://...).'); return; }

    setSaving(true);
    try {
      const type = detectType(form.url);
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        fileUrl: form.url.trim(),
        courseId: form.courseId,
        subject: form.subject.trim(),
        type,
      };

      if (editingId) {
        await updateDoc(doc(db, 'content', editingId), data);
      } else {
        await addDoc(collection(db, 'content'), { ...data, createdAt: serverTimestamp() });
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'content', id));
    setContents(prev => prev.filter(c => c.id !== id));
    setDeleteConfirm(null);
  };

  const getCourseName = id => courses.find(c => c.id === id)?.name || '';

  const filtered = contents.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q || item.title?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q) || item.subject?.toLowerCase().includes(q);
    const matchCourse = filterCourse === 'all' || item.courseId === filterCourse;
    return matchSearch && matchCourse;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Resources</h1>
          <p className="text-sm text-slate-500">{contents.length} resource{contents.length !== 1 ? 's' : ''} · link-based content</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#255A84] hover:bg-[#1a4261] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition"
        >
          <Plus size={16} /> Add Resource
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, subject, description…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84]"
          />
        </div>
        <select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84] bg-white min-w-[140px]"
        >
          <option value="all">All Courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-7 w-7 border-4 border-[#255A84] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search || filterCourse !== 'all' ? 'No resources match your filter.' : 'No resources yet.'}</p>
          {!search && filterCourse === 'all' && (
            <p className="text-sm mt-1">Click "Add Resource" to share a link with students.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(item => {
            const type = item.type || detectType(item.fileUrl);
            return (
              <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                    <TypeIcon type={type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm leading-snug">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge(type)}`}>
                        {typeLabel(type)}
                      </span>
                      {getCourseName(item.courseId) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#255A84]/10 text-[#255A84] font-medium">
                          {getCourseName(item.courseId)}
                        </span>
                      )}
                      {item.subject && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {item.subject}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs text-[#255A84] font-semibold py-2 hover:bg-blue-50 rounded-lg transition"
                  >
                    <ExternalLink size={13} /> Open Link
                  </a>
                  <button
                    onClick={() => openEdit(item)}
                    className="p-2 text-slate-400 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-slate-800">{editingId ? 'Edit Resource' : 'Add Resource'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84]"
                  placeholder="e.g. HTML & CSS Notes"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84] resize-none"
                  rows={2}
                  placeholder="Brief description of the resource…"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">URL *</label>
                <input
                  required
                  type="url"
                  value={form.url}
                  onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setUrlError(''); }}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition ${urlError ? 'border-red-300 focus:ring-red-300' : 'border-slate-200 focus:ring-[#255A84]'}`}
                  placeholder="https://docs.google.com/... or https://..."
                />
                {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
                {form.url && isValidUrl(form.url) && (
                  <p className="text-xs text-slate-400 mt-1">
                    Detected: <strong>{typeLabel(detectType(form.url))}</strong>
                  </p>
                )}
              </div>

              {/* Course */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Course</label>
                  <select
                    value={form.courseId}
                    onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84] bg-white"
                  >
                    <option value="">Select course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Subject / Tag</label>
                  <input
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84]"
                    placeholder="e.g. HTML, DSA"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#255A84] hover:bg-[#1a4261] text-white rounded-xl text-sm font-semibold transition disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editingId ? 'Update' : 'Add Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h2 className="font-bold text-slate-800 mb-1">Delete Resource?</h2>
            <p className="text-sm text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
