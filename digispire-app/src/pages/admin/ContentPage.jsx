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
  FolderGit2
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
    gdrive: 'Drive Folder',
    video: 'Video Lecture',
    link: 'Web Resource'
  };
  return map[type] || 'Resource';
}

function typeBadgeStyle(type) {
  const map = {
    pdf: 'bg-rose-50 text-rose-700 border-rose-200/70',
    gdrive: 'bg-sky-50 text-sky-700 border-sky-200/70',
    video: 'bg-purple-50 text-purple-700 border-purple-200/70',
    link: 'bg-blue-50 text-blue-700 border-blue-200/70',
  };
  return map[type] || map.link;
}

function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return 'Web Link';
  }
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

  // Counts for pills
  const totalResources = contents.length;
  const pinnedCount = contents.filter(c => c.isPinned).length;
  const docsCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'pdf').length;
  const videoCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'video').length;
  const driveCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'gdrive').length;

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
    <div className="space-y-4 sm:space-y-6 pb-16 font-sans">
      {/* ── Executive Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-br from-[#255A84] via-[#1f4b6e] to-[#0F172A] text-white flex items-center justify-center shadow-md shadow-[#255A84]/20 border border-white/10 shrink-0">
            <BookOpen size={20} className="text-blue-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">
                Study Material & Media Hub
              </h1>
              <span className="hidden sm:inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#255A84] border border-blue-100">
                Admin
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
              Publish video lectures, PDF notes, drive folders, and monitor student engagement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {/* View Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon size={13} />
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#255A84] hover:bg-[#1c4566] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95"
          >
            <Plus size={15} /> Publish Material
          </button>
        </div>
      </div>

      {/* ── Search & Filter Control Bar ── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Quick Course Track Strip */}
        {courses.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-slate-100">
            <button
              onClick={() => setFilterCourse('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                filterCourse === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
              }`}
            >
              <span>All Courses</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                filterCourse === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {contents.length}
              </span>
            </button>

            {courses.map(course => {
              const count = contents.filter(c => c.courseId === course.id).length;
              const isSelected = filterCourse === course.id;
              return (
                <button
                  key={course.id}
                  onClick={() => setFilterCourse(course.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#255A84] text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                  }`}
                >
                  <span>{course.name}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search materials by title, topic, or course..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all cursor-pointer"
            >
              <option value="newest">🕒 Newest</option>
              <option value="popular">🔥 Popular</option>
              <option value="title">🔤 Title</option>
              <option value="pinned">📌 Pinned</option>
            </select>
          </div>
        </div>

        {/* ── Category Filter Pills ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          {[
            { id: 'all', label: `All`, count: totalResources },
            { id: 'pinned', label: `📌 Pinned`, count: pinnedCount },
            { id: 'video', label: `🎥 Videos`, count: videoCount },
            { id: 'pdf', label: `📄 PDF Notes`, count: docsCount },
            { id: 'gdrive', label: `📁 Drive Folders`, count: driveCount },
            { id: 'link', label: `🔗 Links` },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-[#255A84] text-white shadow-xs'
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
            <span className="text-slate-500 font-medium text-[11px]">
              Showing <strong className="text-slate-800">{filtered.length}</strong> resources
            </span>
            <button
              onClick={handleResetFilters}
              className="text-[#255A84] font-bold hover:underline flex items-center gap-1 text-[11px]"
            >
              <RotateCcw size={11} /> Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Main Content Area ── */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#255A84] border-t-transparent" />
          <p className="text-xs text-slate-400 font-bold">Loading media library...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center text-slate-400 text-xs font-semibold space-y-2.5 shadow-xs">
          <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-1">
            <BookOpen size={24} />
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-700">No Resources Found</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters ? 'Try adjusting your search query or filter.' : 'Click "Publish Material" to add your first resource.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 bg-[#255A84] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5"
            >
              <RotateCcw size={12} /> Reset Filters
            </button>
          ) : (
            <button
              onClick={openAdd}
              className="px-3.5 py-1.5 bg-[#255A84] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5"
            >
              <Plus size={13} /> Add Resource
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* ── Studio Bento Responsive Cards Grid ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4.5">
          {filtered.map(item => {
            const type = item.type || detectType(item.fileUrl || item.url);
            const courseName = getCourseName(item.courseId);
            const youtubeThumb = getYoutubeThumbnail(item.fileUrl || item.url);
            const hasEmbed = getEmbedUrl(item.fileUrl || item.url);
            const domain = getDomain(item.fileUrl || item.url);

            const handleLaunch = () => {
              if (hasEmbed) {
                setPreviewMedia(item);
              } else if (item.fileUrl || item.url) {
                window.open(item.fileUrl || item.url, '_blank', 'noopener,noreferrer');
              }
            };

            return (
              <div
                key={item.id}
                onClick={handleLaunch}
                className={`group relative bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-0.5 select-none ${
                  item.isPinned
                    ? 'border-amber-300/90 shadow-2xs'
                    : type === 'video'
                    ? 'border-slate-200/90 hover:border-purple-300'
                    : type === 'pdf'
                    ? 'border-slate-200/90 hover:border-rose-300'
                    : type === 'gdrive'
                    ? 'border-slate-200/90 hover:border-sky-300'
                    : 'border-slate-200/90 hover:border-blue-300'
                }`}
              >
                {/* Pinned Ribbon Top Accent */}
                {item.isPinned && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-3 py-0.5 flex items-center justify-between uppercase tracking-wider shadow-2xs">
                    <span className="flex items-center gap-1">
                      <Pin size={10} fill="white" /> Pinned Note
                    </span>
                    {courseName && <span className="text-[8px] font-bold text-amber-100 uppercase truncate max-w-[140px]">{courseName}</span>}
                  </div>
                )}

                {/* ── CARD HEADER / VISUAL PRESENTATION ── */}
                {type === 'video' ? (
                  /* 🎥 Cinema Video Preview Header */
                  <div className="relative aspect-video w-full bg-slate-950 overflow-hidden group/thumb">
                    {youtubeThumb ? (
                      <img
                        src={youtubeThumb}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300 opacity-90"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 flex items-center justify-center">
                        <Video size={36} className="text-purple-400/30" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-slate-950/25 group-hover/thumb:bg-slate-950/10 transition-colors flex items-center justify-center">
                      <div className="h-11 w-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-red-500 transition-all">
                        <Play size={18} fill="white" className="ml-0.5" />
                      </div>
                    </div>

                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-black/75 backdrop-blur-md text-white text-[9.5px] font-bold rounded-md border border-white/10 flex items-center gap-1 shadow-xs">
                        <Video size={10} className="text-purple-400" /> Lecture
                      </span>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(item, e); }}
                      title={item.isPinned ? 'Unpin' : 'Pin to top'}
                      className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg backdrop-blur-md transition shadow-xs ${
                        item.isPinned ? 'bg-amber-500 text-white' : 'bg-black/60 text-white/80 hover:text-white hover:bg-black/80'
                      }`}
                    >
                      <Pin size={13} fill={item.isPinned ? 'currentColor' : 'none'} />
                    </button>

                    <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-md text-slate-200 text-[9px] font-mono font-bold rounded">
                      Preview Player
                    </span>
                  </div>
                ) : (
                  /* 📑 PDF / 📁 Drive / 🔗 Web Link Header with Tactile Icon Gem */
                  <div className={`p-3.5 sm:p-4 pb-1 border-b flex items-start justify-between gap-3 ${
                    type === 'pdf' 
                      ? 'bg-gradient-to-r from-rose-500/[0.07] via-rose-50/40 to-transparent border-rose-100/60' 
                      : type === 'gdrive'
                      ? 'bg-gradient-to-r from-sky-500/[0.07] via-sky-50/40 to-transparent border-sky-100/60'
                      : 'bg-gradient-to-r from-blue-500/[0.07] via-blue-50/40 to-transparent border-blue-100/60'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Tactile Icon Gem */}
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105 border ${
                        type === 'pdf'
                          ? 'bg-rose-600 text-white border-rose-700/20 shadow-rose-200'
                          : type === 'gdrive'
                          ? 'bg-sky-500 text-white border-sky-600/20 shadow-sky-200'
                          : 'bg-[#255A84] text-white border-blue-800/20 shadow-blue-200'
                      }`}>
                        {type === 'pdf' ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[7.5px] font-black tracking-tighter leading-none">PDF</span>
                            <FileText size={12} className="mt-0.5 opacity-90" />
                          </div>
                        ) : type === 'gdrive' ? (
                          <FolderGit2 size={18} />
                        ) : (
                          <Globe size={18} />
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            type === 'pdf' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            type === 'gdrive' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                            'bg-blue-50 text-[#255A84] border-blue-200'
                          }`}>
                            {typeLabel(type)}
                          </span>
                          {courseName && !item.isPinned && (
                            <span className="text-[9.5px] font-bold text-slate-500 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200/60 truncate max-w-[120px]">
                              {courseName}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium truncate">
                          {type === 'pdf' ? 'Printable Study Material' :
                           type === 'gdrive' ? 'Shared Worksheets & Files' :
                           domain}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(item, e); }}
                      title={item.isPinned ? 'Unpin from Top' : 'Pin to Top'}
                      className={`p-1.5 rounded-lg transition shrink-0 ${
                        item.isPinned 
                          ? 'bg-amber-50 text-amber-500 border border-amber-200' 
                          : 'text-slate-400 hover:text-amber-500 hover:bg-white/80 border border-transparent'
                      }`}
                    >
                      <Pin size={14} fill={item.isPinned ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                )}

                {/* ── CARD CONTENT BODY ── */}
                <div className="p-3.5 sm:p-4 space-y-1.5 flex-1">
                  {type === 'video' && courseName && !item.isPinned && (
                    <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider text-[#255A84] bg-blue-50 px-2 py-0.5 rounded">
                      {courseName}
                    </span>
                  )}

                  <h3 className="font-bold text-slate-800 text-xs sm:text-sm leading-snug group-hover:text-[#255A84] transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  {item.description && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {item.subject && (
                    <div className="pt-0.5">
                      <span className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        #{item.subject}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── CARD FOOTER ACTIONS ── */}
                <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1.5 text-xs mt-auto">
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Eye size={11} /> {item.clicks || 0} views
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleLaunch}
                      className="p-1.5 text-slate-500 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition"
                      title={hasEmbed ? 'Preview' : 'Open Link'}
                    >
                      {hasEmbed ? <Maximize2 size={13} /> : <ExternalLink size={13} />}
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyLink(item, e); }}
                      title="Copy Link"
                      className={`p-1.5 rounded-lg border transition ${
                        copiedId === item.id 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                          : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                      title="Edit"
                      className="p-1.5 bg-white text-slate-400 border border-slate-200 rounded-lg hover:text-[#255A84] hover:bg-blue-50 transition"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item.id); }}
                      title="Delete"
                      className="p-1.5 bg-white text-slate-400 border border-slate-200 rounded-lg hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-3">Resource Title</th>
                  <th className="px-3 py-3">Type & Track</th>
                  <th className="px-3 py-3">Topic Tag</th>
                  <th className="px-3 py-3">Views</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map(item => {
                  const type = item.type || detectType(item.fileUrl || item.url);
                  const courseName = getCourseName(item.courseId);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={(e) => togglePin(item, e)}
                            title={item.isPinned ? 'Pinned' : 'Click to pin'}
                            className={`p-0.5 rounded transition ${item.isPinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                          >
                            <Pin size={13} fill={item.isPinned ? 'currentColor' : 'none'} />
                          </button>

                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            type === 'pdf' ? 'text-rose-600 bg-rose-50 border-rose-200' :
                            type === 'video' ? 'text-purple-600 bg-purple-50 border-purple-200' :
                            type === 'gdrive' ? 'text-sky-600 bg-sky-50 border-sky-200' :
                            'text-[#255A84] bg-blue-50 border-blue-200'
                          }`}>
                            <TypeIcon type={type} size={15} />
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <p className="font-bold text-slate-800 truncate text-xs">{item.title}</p>
                            {item.description && (
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="space-y-0.5">
                          <span className={`inline-block px-1.5 py-0.2 rounded-full text-[8px] font-black border ${typeBadgeStyle(type)}`}>
                            {typeLabel(type)}
                          </span>
                          {courseName && (
                            <p className="text-[10px] font-bold text-[#255A84] truncate max-w-[120px]">{courseName}</p>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        {item.subject ? (
                          <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                            #{item.subject}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic text-[11px]">None</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <span className="font-bold text-slate-700 flex items-center gap-1 text-[11px]">
                          <Eye size={11} className="text-slate-400" />
                          {item.clicks || 0}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getEmbedUrl(item.fileUrl || item.url) && (
                            <button
                              onClick={() => setPreviewMedia(item)}
                              className="p-1 text-slate-400 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition"
                              title="Preview"
                            >
                              <Maximize2 size={13} />
                            </button>
                          )}
                          <a
                            href={item.fileUrl || item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition"
                            title="Open Link"
                          >
                            <ExternalLink size={13} />
                          </a>
                          <button
                            onClick={(e) => handleCopyLink(item, e)}
                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Copy Link"
                          >
                            {copiedId === item.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1 text-slate-400 hover:text-[#255A84] hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={13} />
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
          <div className="bg-slate-900 rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-800 shadow-2xl text-white font-sans">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                  <TypeIcon type={previewMedia.type || detectType(previewMedia.fileUrl || previewMedia.url)} size={16} />
                </div>
                <div className="min-w-0">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeBadgeStyle(previewMedia.type || detectType(previewMedia.fileUrl || previewMedia.url))}`}>
                    {typeLabel(previewMedia.type || detectType(previewMedia.fileUrl || previewMedia.url))}
                  </span>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-100 truncate mt-0.5">{previewMedia.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X size={18} />
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
                  <div className="h-10 w-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <ExternalLink size={20} />
                  </div>
                  <p>In-app embed preview is not available for this link type.</p>
                  <a
                    href={previewMedia.fileUrl || previewMedia.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#255A84] hover:bg-[#1c4566] text-white font-bold rounded-xl transition"
                  >
                    <ExternalLink size={13} /> Open in New Window
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs gap-3">
              <p className="text-slate-300 text-xs truncate max-w-md">{previewMedia.description || 'No description provided.'}</p>
              <a
                href={previewMedia.fileUrl || previewMedia.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-[#255A84] hover:bg-[#1c4566] text-white font-bold rounded-xl transition flex items-center gap-1.5 shrink-0"
              >
                <ExternalLink size={13} /> Open Link Externally
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Material Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col border border-slate-200 font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-[#255A84]/10 text-[#255A84] rounded-lg">
                  <Sparkles size={16} />
                </span>
                <div>
                  <h2 className="font-extrabold text-slate-800 text-sm sm:text-base">
                    {editingId ? 'Edit Study Material' : 'Publish Study Material'}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Link video lectures, drive folders, or PDF notes</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
              {/* Resource Title */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Resource Title *
                </label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
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
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none transition-all ${
                    urlError ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200/80 focus:border-[#255A84]'
                  }`}
                  placeholder="https://youtube.com/..., https://drive.google.com/..."
                />
                {urlError && <p className="text-xs text-rose-500 font-semibold mt-1">{urlError}</p>}

                {/* Auto-Detection Badge Preview */}
                {form.url && isValidUrl(form.url) && (
                  <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center border ${
                        detectType(form.url) === 'pdf' ? 'text-rose-600 bg-rose-50 border-rose-200' :
                        detectType(form.url) === 'video' ? 'text-purple-600 bg-purple-50 border-purple-200' :
                        detectType(form.url) === 'gdrive' ? 'text-sky-600 bg-sky-50 border-sky-200' :
                        'text-[#255A84] bg-blue-50 border-blue-200'
                      }`}>
                        <TypeIcon type={detectType(form.url)} size={14} />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-[11px]">{typeLabel(detectType(form.url))}</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="">All Courses (General)</option>
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all resize-none"
                  rows={2}
                  placeholder="Summary of topics covered, prerequisites, or notes..."
                />
              </div>

              {/* Pin Checkbox */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <input
                  type="checkbox"
                  id="isPinnedCheck"
                  checked={form.isPinned}
                  onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))}
                  className="h-4 w-4 rounded border-amber-300 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="isPinnedCheck" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                  <Pin size={13} className="text-amber-500" /> Pin this resource to top of list
                </label>
              </div>

              {/* Footer Actions */}
              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-[#255A84] hover:bg-[#1a4261] text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-60"
                >
                  {saving ? 'Publishing...' : editingId ? 'Update Material' : 'Publish Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm p-5 sm:p-6 text-center border border-slate-100 font-sans">
            <div className="h-12 w-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} />
            </div>
            <h2 className="font-bold text-slate-800 text-base mb-1">Delete Study Material?</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              This action will remove the link from the student resources library.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
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
