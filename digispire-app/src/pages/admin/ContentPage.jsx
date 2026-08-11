import { useEffect, useState, useMemo } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Plus, FileText, Globe, Trash2, Pencil, X,
  ExternalLink, Search, BookOpen, Video, FolderOpen,
  Eye, Copy, Check, LayoutGrid, Table as TableIcon,
  RotateCcw, Sparkles, Pin, Play, Maximize2
} from 'lucide-react';

// Detect URL resource type
function detectType(url) {
  if (!url) return 'link';
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) return 'gdrive';
  if (lower.includes('.pdf') || lower.includes('pdf')) return 'pdf';
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com')) return 'video';
  return 'link';
}

function typeLabel(type) {
  const map = { pdf: 'PDF Document', gdrive: 'Google Drive', video: 'Video Lecture', link: 'Web Link' };
  return map[type] || 'Resource Link';
}

function typeBadgeStyle(type) {
  const map = {
    pdf: 'bg-rose-500/10 text-rose-700 border-rose-200/80',
    gdrive: 'bg-blue-500/10 text-blue-700 border-blue-200/80',
    video: 'bg-purple-500/10 text-purple-700 border-purple-200/80',
    link: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/80',
  };
  return map[type] || map.link;
}

function typeHeaderGradient(type) {
  const map = {
    pdf: 'from-rose-500/10 via-rose-500/5 to-transparent text-rose-600',
    gdrive: 'from-blue-500/10 via-blue-500/5 to-transparent text-blue-600',
    video: 'from-purple-500/10 via-purple-500/5 to-transparent text-purple-600',
    link: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-600',
  };
  return map[type] || map.link;
}

function TypeIcon({ type, size = 18 }) {
  if (type === 'pdf') return <FileText size={size} className="text-rose-600" />;
  if (type === 'gdrive') return <img src="https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png" className="w-5 h-5 object-contain" alt="Drive" />;
  if (type === 'video') return <Video size={size} className="text-purple-600" />;
  return <Globe size={size} className="text-emerald-600" />;
}

// Convert video / drive URLs into embeddable preview URLs
function getEmbedUrl(url) {
  if (!url) return null;
  if (url.includes('youtube.com/watch?v=')) {
    const id = url.split('watch?v=')[1]?.split('&')[0];
    return `https://www.youtube.com/embed/${id}?autoplay=1`;
  }
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${id}?autoplay=1`;
  }
  if (url.includes('drive.google.com/file/d/')) {
    const id = url.split('/file/d/')[1]?.split('/')[0];
    return `https://drive.google.com/file/d/${id}/preview`;
  }
  return null;
}

// Get YouTube video thumbnail if applicable
function getYoutubeThumbnail(url) {
  if (!url) return null;
  let id = null;
  if (url.includes('youtube.com/watch?v=')) {
    id = url.split('watch?v=')[1]?.split('&')[0];
  } else if (url.includes('youtu.be/')) {
    id = url.split('youtu.be/')[1]?.split('?')[0];
  }
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function isValidUrl(url) {
  try { new URL(url); return true; } catch { return false; }
}

const emptyForm = { title: '', description: '', url: '', courseId: '', subject: '', isPinned: false };

export default function ContentPage() {
  const [contents, setContents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI View Mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState('cards');

  // Interactive Media Preview Modal state
  const [previewMedia, setPreviewMedia] = useState(null);

  // Modal & Form states
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [urlError, setUrlError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Copy feedback tracking
  const [copiedId, setCopiedId] = useState(null);

  // Filter & Tab States
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pinned', 'pdf', 'gdrive', 'video', 'link'

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cSnap, contentSnap] = await Promise.all([
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'content')),
      ]);
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const items = contentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setContents(items.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      }));
    } catch (err) {
      console.error('Error fetching resources:', err);
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
      isPinned: !!item.isPinned,
    });
    setEditingId(item.id);
    setUrlError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setUrlError('');
    if (!form.url.trim()) { setUrlError('URL is required.'); return; }
    if (!isValidUrl(form.url.trim())) { setUrlError('Please enter a valid URL starting with https:// or http://'); return; }

    setSaving(true);
    try {
      const type = detectType(form.url);
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        fileUrl: form.url.trim(),
        courseId: form.courseId,
        subject: form.subject.trim(),
        isPinned: form.isPinned,
        type,
      };

      if (editingId) {
        await updateDoc(doc(db, 'content', editingId), data);
      } else {
        await addDoc(collection(db, 'content'), { ...data, clicks: 0, createdAt: serverTimestamp() });
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      console.error('Error saving resource:', err);
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (item, e) => {
    e.stopPropagation();
    try {
      const newPinState = !item.isPinned;
      await updateDoc(doc(db, 'content', item.id), { isPinned: newPinState });
      setContents(prev => prev.map(c => c.id === item.id ? { ...c, isPinned: newPinState } : c));
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'content', id));
      setContents(prev => prev.filter(c => c.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting resource:', err);
    }
  };

  const handleCopyLink = (item, e) => {
    if (e) e.stopPropagation();
    const link = item.fileUrl || item.url;
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCourseName = id => courses.find(c => c.id === id)?.name || '';

  // Filtered List
  const filtered = useMemo(() => {
    return contents.filter(item => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.subject?.toLowerCase().includes(q);

      const matchCourse = filterCourse === 'all' || item.courseId === filterCourse;
      const type = item.type || detectType(item.fileUrl || item.url);

      let matchTab = true;
      if (activeTab === 'pinned') matchTab = !!item.isPinned;
      else if (activeTab !== 'all') matchTab = type === activeTab;

      return matchSearch && matchCourse && matchTab;
    });
  }, [contents, search, filterCourse, activeTab]);

  const hasActiveFilters = search || filterCourse !== 'all' || activeTab !== 'all';

  const handleResetFilters = () => {
    setSearch('');
    setFilterCourse('all');
    setActiveTab('all');
  };

  // Executive Metrics
  const totalResources = contents.length;
  const pinnedCount = contents.filter(c => c.isPinned).length;
  const docsCount = contents.filter(c => (c.type || detectType(c.fileUrl)) === 'pdf' || (c.type || detectType(c.fileUrl)) === 'gdrive').length;
  const videoCount = contents.filter(c => (c.type || detectType(c.fileUrl)) === 'video').length;
  const totalViews = contents.reduce((acc, c) => acc + (c.clicks || 0), 0);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#255A84] via-[#1f4b6e] to-[#14334c] text-white flex items-center justify-center shadow-lg shadow-[#255A84]/25">
            <Sparkles size={22} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              Resources & Media Hub
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Interactive library with live video playback, PDF previews, pinned featured docs, and engagement metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View Mode Switcher */}
          <div className="bg-slate-200/60 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#255A84] to-[#1c4566] hover:from-[#1c4566] hover:to-[#14334c] text-white text-xs font-bold rounded-xl shadow-md shadow-[#255A84]/20 transition-all active:scale-95"
          >
            <Plus size={16} /> Add Resource
          </button>
        </div>
      </div>

      {/* ── Stat Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-[#255A84] flex items-center justify-center shrink-0 font-bold">
            <FolderOpen size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{totalResources}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Total Published</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 font-bold">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{docsCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">PDF & Drive Files</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 font-bold">
            <Video size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{videoCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Video Sessions</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
            <Eye size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{totalViews}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Student Clicks</p>
          </div>
        </div>
      </div>

      {/* ── Category Filter Tabs ── */}
      <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: `All (${totalResources})` },
          { id: 'pinned', label: `📌 Pinned (${pinnedCount})` },
          { id: 'pdf', label: `📄 PDF Docs` },
          { id: 'gdrive', label: `📁 Drive Files` },
          { id: 'video', label: `🎥 Videos` },
          { id: 'link', label: `🔗 Links` },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#255A84] text-white shadow-md shadow-[#255A84]/15'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Search & Course Toolbar ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search resources by title, subject tag, or description..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={filterCourse}
            onChange={e => setFilterCourse(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all min-w-[150px]"
          >
            <option value="all">All Course Tracks</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Showing {filtered.length} matching items</span>
            <button
              onClick={handleResetFilters}
              className="text-[#255A84] font-bold hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Main Content Area ── */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
          <p className="text-xs text-slate-400 font-bold">Loading media hub...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center text-slate-400 text-xs font-semibold space-y-2">
          <BookOpen size={48} className="mx-auto mb-2 opacity-20 text-slate-500" />
          <p className="text-base font-bold text-slate-700">No Matching Resources Found</p>
          <p>{hasActiveFilters ? 'Try adjusting your search query or active filter tabs.' : 'Click "Add Resource" to publish content.'}</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* ── CARD GRID VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(item => {
            const type = item.type || detectType(item.fileUrl || item.url);
            const courseName = getCourseName(item.courseId);
            const youtubeThumb = getYoutubeThumbnail(item.fileUrl || item.url);
            const hasEmbed = getEmbedUrl(item.fileUrl || item.url);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden group relative ${
                  item.isPinned ? 'border-amber-300/80 shadow-md shadow-amber-500/5' : 'border-slate-100 shadow-sm hover:shadow-md hover:border-[#255A84]/20'
                }`}
              >
                {/* Pinned Ribbon Badge */}
                {item.isPinned && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-extrabold px-3 py-0.5 flex items-center justify-center gap-1 uppercase tracking-widest shadow-xs">
                    <Pin size={10} fill="white" />
                    Pinned Resource
                  </div>
                )}

                {/* Video Thumbnail / Banner Preview */}
                {youtubeThumb ? (
                  <div
                    onClick={() => setPreviewMedia(item)}
                    className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer group/thumb"
                  >
                    <img src={youtubeThumb} alt={item.title} className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500 opacity-90" />
                    <div className="absolute inset-0 bg-slate-900/30 group-hover/thumb:bg-slate-900/10 transition-colors flex items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg group-hover/thumb:scale-110 transition-transform">
                        <Play size={20} fill="white" className="ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white text-[9px] font-bold rounded-md flex items-center gap-1">
                      <Video size={10} /> Watch Video
                    </span>
                  </div>
                ) : (
                  <div className={`p-4 bg-gradient-to-r ${typeHeaderGradient(type)} border-b border-slate-100/60 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-xs">
                        <TypeIcon type={type} size={18} />
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeBadgeStyle(type)}`}>
                        {typeLabel(type)}
                      </span>
                    </div>

                    <button
                      onClick={(e) => togglePin(item, e)}
                      title={item.isPinned ? 'Unpin resource' : 'Pin to top'}
                      className={`p-1.5 rounded-lg transition ${
                        item.isPinned ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-white/80'
                      }`}
                    >
                      <Pin size={14} fill={item.isPinned ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                )}

                {/* Card Body */}
                <div className="p-5 space-y-3 flex-1">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-snug group-hover:text-[#255A84] transition-colors">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {courseName && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-[#255A84]">
                        {courseName}
                      </span>
                    )}
                    {item.subject && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        #{item.subject}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Eye size={11} /> {item.clicks || 0} views
                    </span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 text-xs">
                  {hasEmbed ? (
                    <button
                      onClick={() => setPreviewMedia(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#255A84] text-white font-bold rounded-xl hover:bg-[#1a4261] transition active:scale-95 shadow-xs"
                    >
                      <Maximize2 size={13} /> Preview
                    </button>
                  ) : (
                    <a
                      href={item.fileUrl || item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white border border-slate-200/80 text-[#255A84] font-bold rounded-xl hover:bg-[#255A84] hover:text-white hover:border-[#255A84] transition active:scale-95"
                    >
                      <ExternalLink size={13} /> Open
                    </a>
                  )}

                  <button
                    onClick={(e) => handleCopyLink(item, e)}
                    title="Copy Link to Clipboard"
                    className={`p-2 rounded-xl border transition ${
                      copiedId === item.id 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                        : 'bg-white text-slate-500 border-slate-200/80 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>

                  <button
                    onClick={() => openEdit(item)}
                    title="Edit Resource"
                    className="p-2 bg-white text-slate-500 border border-slate-200/80 rounded-xl hover:text-[#255A84] hover:bg-blue-50 hover:border-blue-200 transition"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={() => setDeleteConfirm(item.id)}
                    title="Delete Resource"
                    className="p-2 bg-white text-slate-500 border border-slate-200/80 rounded-xl hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-3.5">Resource Title</th>
                  <th className="px-4 py-3.5">Type & Track</th>
                  <th className="px-4 py-3.5">Subject / Tag</th>
                  <th className="px-4 py-3.5">Views</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(item => {
                  const type = item.type || detectType(item.fileUrl || item.url);
                  const courseName = getCourseName(item.courseId);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => togglePin(item, e)}
                            title={item.isPinned ? 'Pinned' : 'Click to pin'}
                            className={`p-1 rounded-md transition ${item.isPinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                          >
                            <Pin size={14} fill={item.isPinned ? 'currentColor' : 'none'} />
                          </button>

                          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                            <TypeIcon type={type} size={16} />
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <p className="font-bold text-slate-800 text-xs truncate">{item.title}</p>
                            {item.description && (
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${typeBadgeStyle(type)}`}>
                            {typeLabel(type)}
                          </span>
                          {courseName && (
                            <p className="text-[10px] font-bold text-[#255A84] truncate max-w-[140px]">{courseName}</p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {item.subject ? (
                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            #{item.subject}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 italic">None</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Eye size={12} className="text-slate-400" />
                          {item.clicks || 0} views
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getEmbedUrl(item.fileUrl || item.url) && (
                            <button
                              onClick={() => setPreviewMedia(item)}
                              className="p-1.5 text-slate-500 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition"
                              title="Preview Media"
                            >
                              <Maximize2 size={14} />
                            </button>
                          )}
                          <a
                            href={item.fileUrl || item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition"
                            title="Open Link"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            onClick={(e) => handleCopyLink(item, e)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Copy Link"
                          >
                            {copiedId === item.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(item.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Interactive In-App Media Preview Modal ── */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-800 shadow-2xl text-white font-sans">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <TypeIcon type={previewMedia.type || detectType(previewMedia.fileUrl || previewMedia.url)} size={20} />
                <h3 className="font-bold text-sm truncate">{previewMedia.title}</h3>
              </div>
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Embed Frame */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              {getEmbedUrl(previewMedia.fileUrl || previewMedia.url) ? (
                <iframe
                  src={getEmbedUrl(previewMedia.fileUrl || previewMedia.url)}
                  title={previewMedia.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                  Preview not available inline. Click "Open Link" to view externally.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
              <p className="text-slate-400 text-xs truncate max-w-md">{previewMedia.description || 'No description provided.'}</p>
              <a
                href={previewMedia.fileUrl || previewMedia.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#255A84] hover:bg-[#1c4566] text-white font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <ExternalLink size={14} /> Open Link Externally
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col border border-slate-100 font-sans">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-[#255A84]/10 text-[#255A84] rounded-lg">
                  <Sparkles size={16} />
                </span>
                <h2 className="font-bold text-slate-800 text-base">{editingId ? 'Edit Resource' : 'Add New Resource'}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Resource Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
                  placeholder="e.g. Full-Stack Web Dev Cheat Sheet PDF"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Resource Link URL *</label>
                <input
                  required
                  type="url"
                  value={form.url}
                  onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setUrlError(''); }}
                  className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none transition-all ${
                    urlError ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200/80 focus:border-[#255A84]'
                  }`}
                  placeholder="https://docs.google.com/... or https://youtube.com/..."
                />
                {urlError && <p className="text-xs text-rose-500 font-semibold mt-1">{urlError}</p>}

                {/* Live Auto-Detection Banner */}
                {form.url && isValidUrl(form.url) && (
                  <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <TypeIcon type={detectType(form.url)} size={16} />
                      <span className="font-bold text-slate-700">Detected: {typeLabel(detectType(form.url))}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                      Auto-Categorized
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description <span className="normal-case text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all resize-none"
                  rows={2}
                  placeholder="Brief description or key topics covered..."
                />
              </div>

              {/* Course & Subject Tag */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Course Track</label>
                  <select
                    value={form.courseId}
                    onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
                  >
                    <option value="">Select course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Subject / Tag</label>
                  <input
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
                    placeholder="e.g. React, SQL, HTML"
                  />
                </div>
              </div>

              {/* Pin Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isPinnedCheck"
                  checked={form.isPinned}
                  onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-[#255A84] focus:ring-[#255A84]"
                />
                <label htmlFor="isPinnedCheck" className="text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer">
                  <Pin size={13} className="text-amber-500" /> Pin this resource to top of list
                </label>
              </div>

              {/* Footer Actions */}
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#255A84] hover:bg-[#1a4261] text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Resource' : 'Publish Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-100 font-sans">
            <div className="h-12 w-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} />
            </div>
            <h2 className="font-bold text-slate-800 text-base mb-1">Delete Resource?</h2>
            <p className="text-xs text-slate-500 mb-5">This action will remove the link from the student resources library.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
