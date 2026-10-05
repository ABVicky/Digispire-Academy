import { useEffect, useState, useMemo } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Plus, FileText, Globe, Trash2, Pencil, X,
  ExternalLink, Search, BookOpen, Video,
  Eye, Copy, Check, LayoutGrid, Table as TableIcon,
  RotateCcw, Sparkles, Pin, Play, Maximize2,
  Layers, FolderGit2, CheckCircle2, TrendingUp
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptic';

// Detect URL resource type
function detectType(url) {
  if (!url) return 'link';
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) return 'gdrive';
  if (lower.includes('.pdf') || lower.includes('pdf')) return 'pdf';
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com') || lower.includes('loom.com')) return 'video';
  return 'link';
}

function typeLabel(type) {
  const map = {
    pdf: 'PDF Document',
    gdrive: 'Google Drive Folder',
    video: 'Video Masterclass',
    link: 'Web Resource'
  };
  return map[type] || 'Resource Link';
}

function typeBadgeStyle(type) {
  const map = {
    pdf: 'bg-rose-50 text-rose-700 border-rose-200/80',
    gdrive: 'bg-sky-50 text-sky-700 border-sky-200/80',
    video: 'bg-purple-50 text-purple-700 border-purple-200/80',
    link: 'bg-blue-50 text-blue-700 border-blue-200/80',
  };
  return map[type] || map.link;
}

function typeIconColor(type) {
  const map = {
    pdf: 'text-rose-600 bg-rose-50 border-rose-100',
    gdrive: 'text-sky-600 bg-sky-50 border-sky-100',
    video: 'text-purple-600 bg-purple-50 border-purple-100',
    link: 'text-[#255A84] bg-blue-50 border-blue-100',
  };
  return map[type] || map.link;
}

function typeHeaderGradient(type) {
  const map = {
    pdf: 'from-rose-500/10 via-rose-500/5 to-transparent text-rose-600',
    gdrive: 'from-sky-500/10 via-sky-500/5 to-transparent text-sky-600',
    video: 'from-purple-500/10 via-purple-500/5 to-transparent text-purple-600',
    link: 'from-blue-500/10 via-blue-500/5 to-transparent text-blue-600',
  };
  return map[type] || map.link;
}

function TypeIcon({ type, size = 18 }) {
  if (type === 'pdf') return <FileText size={size} className="text-rose-600" />;
  if (type === 'gdrive') return <FolderGit2 size={size} className="text-sky-600" />;
  if (type === 'video') return <Video size={size} className="text-purple-600" />;
  return <Globe size={size} className="text-[#255A84]" />;
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
  if (url.includes('loom.com/share/')) {
    const id = url.split('/share/')[1]?.split('?')[0];
    return `https://www.loom.com/embed/${id}`;
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
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'popular', 'title', 'pinned'

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
    triggerHaptic('light');
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
    triggerHaptic('light');
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
      triggerHaptic('success');
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
      triggerHaptic('light');
      await updateDoc(doc(db, 'content', item.id), { isPinned: newPinState });
      setContents(prev => prev.map(c => c.id === item.id ? { ...c, isPinned: newPinState } : c));
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      triggerHaptic('heavy');
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
    triggerHaptic('light');
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCourseName = id => courses.find(c => c.id === id)?.name || '';

  // Executive Metrics
  const totalResources = contents.length;
  const pinnedCount = contents.filter(c => c.isPinned).length;
  const docsCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'pdf').length;
  const videoCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'video').length;
  const driveCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'gdrive').length;
  const totalViews = contents.reduce((acc, c) => acc + (c.clicks || 0), 0);

  // Filtered & Sorted List
  const filtered = useMemo(() => {
    return contents
      .filter(item => {
        const q = search.toLowerCase().trim();
        const courseName = getCourseName(item.courseId).toLowerCase();
        const type = item.type || detectType(item.fileUrl || item.url);

        const matchSearch = !q ||
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.subject?.toLowerCase().includes(q) ||
          courseName.includes(q);

        const matchCourse = filterCourse === 'all' || item.courseId === filterCourse;

        let matchTab = true;
        if (activeTab === 'pinned') matchTab = !!item.isPinned;
        else if (activeTab !== 'all') matchTab = type === activeTab;

        return matchSearch && matchCourse && matchTab;
      })
      .sort((a, b) => {
        if (sortBy === 'pinned') {
          if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        }
        if (sortBy === 'popular') {
          return (b.clicks || 0) - (a.clicks || 0);
        }
        if (sortBy === 'title') {
          return (a.title || '').localeCompare(b.title || '');
        }
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
  }, [contents, search, filterCourse, activeTab, sortBy, courses]);

  const hasActiveFilters = search || filterCourse !== 'all' || activeTab !== 'all';

  const handleResetFilters = () => {
    setSearch('');
    setFilterCourse('all');
    setActiveTab('all');
    setSortBy('newest');
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* ── Executive Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#255A84] via-[#1f4b6e] to-[#0F172A] text-white flex items-center justify-center shadow-lg shadow-[#255A84]/20 border border-white/10">
            <BookOpen size={22} className="text-blue-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                Study Material & Media Hub
              </h1>
              <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#255A84] border border-blue-100">
                Admin Console
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Publish lecture masterclasses, PDF notes, drive folders, and monitor student engagement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* View Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60">
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
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#255A84] to-[#1c4566] hover:from-[#1c4566] hover:to-[#14334c] text-white text-xs font-black rounded-xl shadow-md shadow-[#255A84]/20 transition-all active:scale-95"
          >
            <Plus size={16} /> Publish Material
          </button>
        </div>
      </div>

      {/* ── Stat Overview Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 text-[#255A84] flex items-center justify-center shrink-0 border border-blue-100">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 leading-none">{totalResources}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Total Published</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <Video size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 leading-none">{videoCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Video Lectures</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 leading-none">{docsCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">PDF Notes</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Pin size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 leading-none">{pinnedCount}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Pinned Cohort Notes</p>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 leading-none">{totalViews}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Student Clicks</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Control Bar ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search materials by title, topic, or course track..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Course Selector */}
            <select
              value={filterCourse}
              onChange={e => setFilterCourse(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all min-w-[150px] cursor-pointer"
            >
              <option value="all">All Course Tracks</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all cursor-pointer"
            >
              <option value="newest">🕒 Newest First</option>
              <option value="popular">🔥 Most Popular</option>
              <option value="title">🔤 Title (A - Z)</option>
              <option value="pinned">📌 Pinned First</option>
            </select>
          </div>
        </div>

        {/* ── Category Filter Pills ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {[
            { id: 'all', label: `All Items`, count: totalResources },
            { id: 'pinned', label: `📌 Pinned`, count: pinnedCount },
            { id: 'video', label: `🎥 Video Lectures`, count: videoCount },
            { id: 'pdf', label: `📄 PDF Notes`, count: docsCount },
            { id: 'gdrive', label: `📁 Drive Folders`, count: driveCount },
            { id: 'link', label: `🔗 Web Links` },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-[#255A84] text-white shadow-md shadow-[#255A84]/15'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{filtered.length}</strong> matching items
            </span>
            <button
              onClick={handleResetFilters}
              className="text-[#255A84] font-bold hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} /> Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Main Content Area ── */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-100 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="animate-spin rounded-full h-9 w-9 border-4 border-[#255A84] border-t-transparent" />
          <p className="text-xs text-slate-400 font-bold">Loading media library...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-100 text-center text-slate-400 text-xs font-semibold space-y-3 shadow-xs">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <BookOpen size={32} />
          </div>
          <h3 className="text-base font-extrabold text-slate-700">No Matching Resources Found</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters ? 'Try adjusting your search query or active filter tags.' : 'Click "Publish Material" to upload or link curriculum resources.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-[#255A84] text-white text-xs font-bold rounded-xl shadow-md inline-flex items-center gap-1.5"
            >
              <RotateCcw size={13} /> Reset Filters
            </button>
          ) : (
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-[#255A84] text-white text-xs font-bold rounded-xl shadow-md inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Add First Resource
            </button>
          )}
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
                className={`bg-white rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden group relative hover:-translate-y-1 hover:shadow-xl ${
                  item.isPinned ? 'border-amber-300/90 shadow-md shadow-amber-500/5' : 'border-slate-200/80 shadow-xs hover:border-[#255A84]/30'
                }`}
              >
                {/* Pinned Ribbon Badge */}
                {item.isPinned && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-3 py-0.5 flex items-center justify-center gap-1 uppercase tracking-widest shadow-xs">
                    <Pin size={10} fill="white" />
                    Pinned Cohort Note
                  </div>
                )}

                {/* Video Thumbnail / Banner Preview */}
                {youtubeThumb ? (
                  <div
                    onClick={() => setPreviewMedia(item)}
                    className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer group/thumb"
                  >
                    <img
                      src={youtubeThumb}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500 opacity-90"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 group-hover/thumb:bg-slate-900/10 transition-colors flex items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg group-hover/thumb:scale-110 transition-transform">
                        <Play size={20} fill="white" className="ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 px-2.5 py-0.5 bg-black/75 backdrop-blur-sm text-white text-[9px] font-extrabold rounded-md flex items-center gap-1">
                      <Video size={10} /> Watch Video
                    </span>
                  </div>
                ) : (
                  <div className={`p-4 bg-gradient-to-r ${typeHeaderGradient(type)} border-b border-slate-100 flex items-center justify-between`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 rounded-2xl flex items-center justify-center shadow-xs border ${typeIconColor(type)}`}>
                        <TypeIcon type={type} size={17} />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${typeBadgeStyle(type)}`}>
                        {typeLabel(type)}
                      </span>
                    </div>

                    <button
                      onClick={(e) => togglePin(item, e)}
                      title={item.isPinned ? 'Unpin resource' : 'Pin to top'}
                      className={`p-1.5 rounded-xl transition ${
                        item.isPinned ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-white/80'
                      }`}
                    >
                      <Pin size={15} fill={item.isPinned ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                )}

                {/* Card Body */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm leading-snug group-hover:text-[#255A84] transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    {courseName ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-[#255A84] border border-blue-100">
                        {courseName}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        General
                      </span>
                    )}
                    {item.subject && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        #{item.subject}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md">
                      <Eye size={11} /> {item.clicks || 0} views
                    </span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2 text-xs">
                  {hasEmbed ? (
                    <button
                      onClick={() => setPreviewMedia(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#255A84] text-white font-bold rounded-xl hover:bg-[#1a4261] transition active:scale-95 shadow-xs"
                    >
                      <Maximize2 size={13} /> Preview
                    </button>
                  ) : (
                    <a
                      href={item.fileUrl || item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white border border-slate-200/80 text-[#255A84] font-bold rounded-xl hover:bg-[#255A84] hover:text-white hover:border-[#255A84] transition active:scale-95"
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
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-3.5">Resource Title</th>
                  <th className="px-4 py-3.5">Type & Track</th>
                  <th className="px-4 py-3.5">Topic Tag</th>
                  <th className="px-4 py-3.5">Engagement</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map(item => {
                  const type = item.type || detectType(item.fileUrl || item.url);
                  const courseName = getCourseName(item.courseId);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => togglePin(item, e)}
                            title={item.isPinned ? 'Pinned' : 'Click to pin'}
                            className={`p-1 rounded-md transition ${item.isPinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                          >
                            <Pin size={14} fill={item.isPinned ? 'currentColor' : 'none'} />
                          </button>

                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${typeIconColor(type)}`}>
                            <TypeIcon type={type} size={16} />
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <p className="font-bold text-slate-800 truncate">{item.title}</p>
                            {item.description && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black border ${typeBadgeStyle(type)}`}>
                            {typeLabel(type)}
                          </span>
                          {courseName && (
                            <p className="text-[11px] font-bold text-[#255A84] truncate max-w-[140px]">{courseName}</p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {item.subject ? (
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            #{item.subject}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">None</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
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
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-800 shadow-2xl text-white font-sans">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                  <TypeIcon type={previewMedia.type || detectType(previewMedia.fileUrl || previewMedia.url)} size={18} />
                </div>
                <div className="min-w-0">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeBadgeStyle(previewMedia.type || detectType(previewMedia.fileUrl || previewMedia.url))}`}>
                    {typeLabel(previewMedia.type || detectType(previewMedia.fileUrl || previewMedia.url))}
                  </span>
                  <h3 className="font-bold text-sm text-slate-100 truncate mt-0.5">{previewMedia.title}</h3>
                </div>
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
                <div className="p-8 text-center text-slate-400 text-xs font-semibold space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <ExternalLink size={24} />
                  </div>
                  <p>In-app embed preview is not available for this link type.</p>
                  <a
                    href={previewMedia.fileUrl || previewMedia.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#255A84] hover:bg-[#1c4566] text-white font-bold rounded-xl transition"
                  >
                    <ExternalLink size={14} /> Open in New Window
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs gap-3">
              <p className="text-slate-300 text-xs truncate max-w-md">{previewMedia.description || 'No description provided.'}</p>
              <a
                href={previewMedia.fileUrl || previewMedia.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#255A84] hover:bg-[#1c4566] text-white font-bold rounded-xl transition flex items-center gap-1.5 shrink-0"
              >
                <ExternalLink size={14} /> Open Link Externally
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Material Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col border border-slate-200 font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-[#255A84]/10 text-[#255A84] rounded-xl">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h2 className="font-extrabold text-slate-800 text-base">
                    {editingId ? 'Edit Study Material' : 'Publish Study Material'}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">Link video lectures, drive folders, or PDF notes</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Resource Title */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Resource Title *
                </label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
                  placeholder="e.g. Master React Hooks & Context API Deep Dive"
                />
              </div>

              {/* Resource Link URL with live auto-detection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Resource URL *
                </label>
                <input
                  required
                  type="url"
                  value={form.url}
                  onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setUrlError(''); }}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none transition-all ${
                    urlError ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200/80 focus:border-[#255A84]'
                  }`}
                  placeholder="https://youtube.com/..., https://drive.google.com/..."
                />
                {urlError && <p className="text-xs text-rose-500 font-semibold mt-1">{urlError}</p>}

                {/* Auto-Detection Badge Preview */}
                {form.url && isValidUrl(form.url) && (
                  <div className="mt-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${typeIconColor(detectType(form.url))}`}>
                        <TypeIcon type={detectType(form.url)} size={16} />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-800">{typeLabel(detectType(form.url))}</span>
                        <p className="text-[10px] text-slate-400">Intelligently categorized for students</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                      Auto-Detected
                    </span>
                  </div>
                )}
              </div>

              {/* Course Track & Topic Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Course Track
                  </label>
                  <select
                    value={form.courseId}
                    onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="">All Course Tracks (General)</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Topic Tag <span className="normal-case text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
                    placeholder="e.g. React, Python, Notes"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Description <span className="normal-case text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all resize-none"
                  rows={2}
                  placeholder="Summary of topics covered, prerequisites, or notes..."
                />
              </div>

              {/* Pin Checkbox */}
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <input
                  type="checkbox"
                  id="isPinnedCheck"
                  checked={form.isPinned}
                  onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))}
                  className="h-4 w-4 rounded border-amber-300 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="isPinnedCheck" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                  <Pin size={14} className="text-amber-500" /> Pin this resource to the top for student cohorts
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
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#255A84] to-[#1c4566] hover:from-[#1c4566] hover:to-[#14334c] text-white rounded-xl text-xs font-black transition shadow-md disabled:opacity-60"
                >
                  {saving ? 'Publishing...' : editingId ? 'Update Material' : 'Publish to Cohort'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-100 font-sans">
            <div className="h-14 w-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
              <Trash2 size={24} />
            </div>
            <h2 className="font-black text-slate-800 text-base mb-1">Delete Study Material?</h2>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              This action will remove the link from the student resources library. Students will no longer see this item.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition shadow-md"
              >
                Delete Material
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
