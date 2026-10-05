import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, getDocs, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  FileText, Globe, ExternalLink, Search, BookOpen, Star, Video,
  Copy, Check, Play, Maximize2, Pin, X, CheckCircle2, Circle,
  Sparkles, Award, Layers, CheckCheck,
  Flame, LayoutGrid, ListFilter, RotateCcw, FolderGit2
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptic';

// Resource Type Detector
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

function typeIconBox(type) {
  const map = {
    pdf: 'text-rose-600 bg-rose-50/80 border-rose-200/60',
    gdrive: 'text-sky-600 bg-sky-50/80 border-sky-200/60',
    video: 'text-purple-600 bg-purple-50/80 border-purple-200/60',
    link: 'text-[#255A84] bg-blue-50/80 border-blue-200/60',
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

export default function StudentContentPage() {
  const [contents, setContents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search, Filters & Sorting
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'bookmarks', 'completed', 'pinned', 'video', 'pdf', 'gdrive', 'link'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'popular', 'title', 'pinned'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'compact'

  // Interaction feedback states
  const [copiedId, setCopiedId] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [recentlyCompletedToast, setRecentlyCompletedToast] = useState(null);

  // Local Storage Bookmarks
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ds_bookmarks') || '[]'); } catch { return []; }
  });

  // Local Storage Completed / Studied Items Tracker
  const [completedItems, setCompletedItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ds_completed_materials') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [cSnap, contentSnap] = await Promise.all([
          getDocs(collection(db, 'courses')),
          getDocs(collection(db, 'content')),
        ]);
        setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const items = contentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setContents(items);
      } catch (err) {
        console.error('Error fetching resources:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Bookmarking Toggle
  const toggleBookmark = useCallback((id) => {
    triggerHaptic('light');
    setBookmarks(prev => {
      const next = prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id];
      localStorage.setItem('ds_bookmarks', JSON.stringify(next));
      return next;
    });
  }, []);

  // Mark Material as Studied / Done Toggle
  const toggleCompleted = useCallback((id, title) => {
    triggerHaptic('success');
    setCompletedItems(prev => {
      const isDone = prev.includes(id);
      const next = isDone ? prev.filter(c => c !== id) : [...prev, id];
      localStorage.setItem('ds_completed_materials', JSON.stringify(next));
      
      if (!isDone) {
        setRecentlyCompletedToast(title || 'Material marked as completed!');
        setTimeout(() => setRecentlyCompletedToast(null), 3000);
      }
      return next;
    });
  }, []);

  // Click Logging
  const logClick = async (id) => {
    try {
      await updateDoc(doc(db, 'content', id), {
        clicks: increment(1),
        lastAccessed: serverTimestamp()
      });
      setContents(prev => prev.map(c => c.id === id ? { ...c, clicks: (c.clicks || 0) + 1 } : c));
    } catch (err) {
      console.error('Error logging click:', err);
    }
  };

  // Copy Link with Toast
  const handleCopyLink = (item, e) => {
    if (e) e.stopPropagation();
    const link = item.fileUrl || item.url;
    if (!link) return;
    navigator.clipboard.writeText(link);
    triggerHaptic('light');
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCourseName = (id) => courses.find(c => c.id === id)?.name || '';

  // Overall Learning Stats
  const totalCount = contents.length;
  const completedCount = contents.filter(c => completedItems.includes(c.id)).length;
  const bookmarkedCount = contents.filter(c => bookmarks.includes(c.id)).length;
  const videoCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'video').length;
  const pdfCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'pdf').length;
  const driveCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'gdrive').length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Filtered & Sorted Content List
  const filtered = useMemo(() => {
    return contents
      .filter(item => {
        const q = search.toLowerCase().trim();
        const type = item.type || detectType(item.fileUrl || item.url);
        const courseName = getCourseName(item.courseId).toLowerCase();

        const matchSearch = !q ||
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.subject?.toLowerCase().includes(q) ||
          courseName.includes(q);

        const matchCourse = filterCourse === 'all' || item.courseId === filterCourse;

        let matchTab = true;
        if (activeTab === 'bookmarks') matchTab = bookmarks.includes(item.id);
        else if (activeTab === 'completed') matchTab = completedItems.includes(item.id);
        else if (activeTab === 'pinned') matchTab = !!item.isPinned;
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
        // Default 'newest'
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
  }, [contents, search, filterCourse, activeTab, sortBy, bookmarks, completedItems, courses]);

  const hasActiveFilters = search || filterCourse !== 'all' || activeTab !== 'all';

  const resetAllFilters = () => {
    setSearch('');
    setFilterCourse('all');
    setActiveTab('all');
    setSortBy('newest');
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-16 font-sans">
      {/* ── Toast Notification for Completed Study Item ── */}
      {recentlyCompletedToast && (
        <div className="fixed bottom-20 right-4 sm:right-8 z-50 bg-emerald-950/90 text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCheck size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-300">Completed! 🎉</p>
            <p className="text-[11px] text-slate-300 truncate max-w-[200px] sm:max-w-xs">{recentlyCompletedToast}</p>
          </div>
        </div>
      )}

      {/* ── Compact Learning Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E3A5F] to-[#255A84] text-white p-4 sm:p-6 shadow-md shadow-[#255A84]/15 border border-white/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 sm:space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold text-blue-200 tracking-wider uppercase backdrop-blur-md">
              <Sparkles size={11} className="text-amber-400" />
              <span>Digispire Learning Hub</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Study Materials & Resources
            </h1>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Explore lecture recordings, downloadable notes, cheat sheets, and shared folders curated for your cohort.
            </p>
          </div>

          {/* Gamified Mini Study Progress Tracker */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/15 shrink-0 min-w-[220px] md:max-w-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Award size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-white tracking-wide">Study Progress</span>
              </div>
              <span className="text-[11px] font-black text-amber-300 bg-amber-400/15 px-2 py-0.5 rounded-md border border-amber-400/20">
                {progressPercent}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-900/60 rounded-full h-2 overflow-hidden p-0.5 border border-white/10">
              <div
                className="bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.max(progressPercent, 4)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-300 font-medium">
              <span>{completedCount} of {totalCount} completed</span>
              {progressPercent >= 100 ? (
                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                  <Flame size={11} /> Done!
                </span>
              ) : (
                <span className="text-slate-400">Keep going</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search, Course Track & Category Filter Bar ── */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-slate-200/80 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search resources, topics, or course..."
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
            {/* Course Selector Dropdown */}
            <select
              value={filterCourse}
              onChange={e => setFilterCourse(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all min-w-[130px] cursor-pointer"
            >
              <option value="all">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all cursor-pointer"
            >
              <option value="newest">🕒 Newest</option>
              <option value="popular">🔥 Popular</option>
              <option value="title">🔤 Title</option>
              <option value="pinned">📌 Pinned</option>
            </select>

            {/* View Mode Toggle (Desktop only) */}
            <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'compact' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Compact List View"
              >
                <ListFilter size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Category Pill Tabs ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          {[
            { id: 'all', label: 'All', icon: Layers, count: totalCount },
            { id: 'bookmarks', label: 'Saved', icon: Star, count: bookmarkedCount, highlight: true },
            { id: 'completed', label: 'Done', icon: CheckCircle2, count: completedCount },
            { id: 'pinned', label: '📌 Pinned', count: contents.filter(c => c.isPinned).length },
            { id: 'video', label: '🎥 Lectures', count: videoCount },
            { id: 'pdf', label: '📄 PDF Notes', count: pdfCount },
            { id: 'gdrive', label: '📁 Drive Folders', count: driveCount },
            { id: 'link', label: '🔗 Links' },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? tab.id === 'bookmarks'
                      ? 'bg-[#F48B1F] text-white shadow-xs'
                      : tab.id === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-[#255A84] text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-100'
                }`}
              >
                {TabIcon && <TabIcon size={12} className={isActive && tab.id === 'bookmarks' ? 'fill-white' : ''} />}
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
              onClick={resetAllFilters}
              className="text-[#255A84] font-bold hover:underline flex items-center gap-1 text-[11px]"
            >
              <RotateCcw size={11} /> Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Content Grid / List Area ── */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#255A84] border-t-transparent" />
          <p className="text-xs text-slate-400 font-bold">Loading materials...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 px-4 text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-2.5">
          <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-1">
            {activeTab === 'bookmarks' ? (
              <Star size={24} className="text-amber-400" />
            ) : activeTab === 'completed' ? (
              <CheckCircle2 size={24} className="text-emerald-500" />
            ) : (
              <BookOpen size={24} className="text-slate-400" />
            )}
          </div>
          <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
            {activeTab === 'bookmarks'
              ? 'No Bookmarks Saved Yet'
              : activeTab === 'completed'
              ? 'No Completed Items Yet'
              : 'No Matching Resources Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === 'bookmarks'
              ? 'Click the star icon on any material to save it to your bookmarks.'
              : activeTab === 'completed'
              ? 'Tap "Mark Done" on items you finish to track your progress.'
              : 'Try searching with a different keyword or filter.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="px-3.5 py-1.5 bg-[#255A84] text-white text-xs font-bold rounded-xl shadow-xs transition hover:bg-[#1a4261] inline-flex items-center gap-1.5"
            >
              <RotateCcw size={12} /> Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Compact Responsive Cards Grid ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4.5">
          {filtered.map(item => (
            <StudentResourceCard
              key={item.id}
              item={item}
              bookmarks={bookmarks}
              completedItems={completedItems}
              onBookmark={toggleBookmark}
              onToggleCompleted={toggleCompleted}
              onLogClick={logClick}
              onCopyLink={handleCopyLink}
              copiedId={copiedId}
              onPreview={setPreviewMedia}
              courseName={getCourseName(item.courseId)}
            />
          ))}
        </div>
      ) : (
        /* ── Compact Table / List Layout ── */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
          {filtered.map(item => (
            <StudentResourceListItem
              key={item.id}
              item={item}
              bookmarks={bookmarks}
              completedItems={completedItems}
              onBookmark={toggleBookmark}
              onToggleCompleted={toggleCompleted}
              onLogClick={logClick}
              onCopyLink={handleCopyLink}
              copiedId={copiedId}
              onPreview={setPreviewMedia}
              courseName={getCourseName(item.courseId)}
            />
          ))}
        </div>
      )}

      {/* ── Interactive In-App Media & Document Viewer Modal ── */}
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

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toggleBookmark(previewMedia.id)}
                  className={`p-1.5 sm:p-2 rounded-lg border transition ${
                    bookmarks.includes(previewMedia.id)
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title={bookmarks.includes(previewMedia.id) ? 'Remove Bookmark' : 'Save Bookmark'}
                >
                  <Star size={15} fill={bookmarks.includes(previewMedia.id) ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => setPreviewMedia(null)}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Embedded Player or Preview Frame */}
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
                    onClick={() => logClick(previewMedia.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#255A84] hover:bg-[#1c4566] text-white font-bold rounded-xl transition"
                  >
                    <ExternalLink size={13} /> Open in New Window
                  </a>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions & Details */}
            <div className="p-3.5 sm:p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="min-w-0">
                {previewMedia.description && (
                  <p className="text-slate-300 text-xs line-clamp-2 leading-relaxed">{previewMedia.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleCompleted(previewMedia.id, previewMedia.title)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                    completedItems.includes(previewMedia.id)
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  <CheckCircle2 size={13} className={completedItems.includes(previewMedia.id) ? 'text-emerald-400' : ''} />
                  {completedItems.includes(previewMedia.id) ? 'Completed' : 'Mark Done'}
                </button>

                <a
                  href={previewMedia.fileUrl || previewMedia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logClick(previewMedia.id)}
                  className="px-3.5 py-1.5 bg-[#255A84] hover:bg-[#1c4566] text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md"
                >
                  <ExternalLink size={13} /> Open Link
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compact Mobile-Optimized Resource Card Component ──
function StudentResourceCard({
  item, bookmarks, completedItems, onBookmark, onToggleCompleted,
  onLogClick, onCopyLink, copiedId, onPreview, courseName
}) {
  const type = item.type || detectType(item.fileUrl || item.url);
  const isBookmarked = bookmarks.includes(item.id);
  const isCompleted = completedItems.includes(item.id);
  const youtubeThumb = getYoutubeThumbnail(item.fileUrl || item.url);
  const hasEmbed = getEmbedUrl(item.fileUrl || item.url);

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden group hover:border-[#255A84]/40 hover:shadow-md ${
      isCompleted
        ? 'border-emerald-200/90 bg-emerald-500/[0.015]'
        : item.isPinned
        ? 'border-amber-300 shadow-2xs'
        : 'border-slate-200/90 shadow-2xs'
    }`}>
      {/* Pinned Ribbon Badge */}
      {item.isPinned && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] sm:text-[9px] font-black px-2.5 py-0.5 flex items-center justify-center gap-1 uppercase tracking-widest shadow-2xs">
          <Pin size={9} fill="white" />
          Featured Note
        </div>
      )}

      {/* Video Media Area */}
      {youtubeThumb ? (
        <div
          onClick={() => { onLogClick(item.id); onPreview(item); }}
          className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer group/thumb"
        >
          <img
            src={youtubeThumb}
            alt={item.title}
            className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300 opacity-90"
          />
          <div className="absolute inset-0 bg-slate-950/30 group-hover/thumb:bg-slate-950/15 transition-colors flex items-center justify-center">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-purple-600/90 backdrop-blur-md text-white flex items-center justify-center shadow-lg group-hover/thumb:scale-110 transition-transform">
              <Play size={18} fill="white" className="ml-0.5" />
            </div>
          </div>
          <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-md text-white text-[9px] font-extrabold rounded-md flex items-center gap-1">
            <Video size={10} className="text-purple-400" /> Watch Video
          </span>
        </div>
      ) : (
        /* Document / Drive Header */
        <div className="p-3.5 sm:p-4 pb-0 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center border shrink-0 ${typeIconBox(type)}`}>
              <TypeIcon type={type} size={17} />
            </div>
            <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeBadgeStyle(type)}`}>
              {typeLabel(type)}
            </span>
          </div>

          <button
            onClick={() => onBookmark(item.id)}
            className={`p-1.5 rounded-lg transition ${
              isBookmarked ? 'bg-[#F48B1F]/10 text-[#F48B1F]' : 'text-slate-300 hover:text-[#F48B1F] hover:bg-amber-50/50'
            }`}
            title={isBookmarked ? 'Remove Bookmark' : 'Save to Bookmarks'}
          >
            <Star size={15} fill={isBookmarked ? '#F48B1F' : 'none'} strokeWidth={isBookmarked ? 1.5 : 2} />
          </button>
        </div>
      )}

      {/* Card Content Body */}
      <div className="p-3.5 sm:p-4 space-y-1 flex-1">
        {courseName && (
          <p className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-[#255A84] truncate">
            {courseName}
          </p>
        )}
        <a
          href={item.fileUrl || item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onLogClick && onLogClick(item.id)}
          className="font-bold text-slate-800 text-xs sm:text-sm leading-snug group-hover:text-[#255A84] transition-colors line-clamp-2 block"
        >
          {item.title}
        </a>
        {item.description && (
          <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2 leading-relaxed pt-0.5">
            {item.description}
          </p>
        )}
        {item.subject && (
          <div className="pt-1">
            <span className="inline-block text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
              #{item.subject}
            </span>
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-1.5 text-xs mt-auto">
        {/* Mark Done Button */}
        <button
          onClick={() => onToggleCompleted(item.id, item.title)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
            isCompleted
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-white text-slate-500 border-slate-200 hover:text-emerald-600 hover:border-emerald-200'
          }`}
          title={isCompleted ? 'Completed (Click to uncheck)' : 'Mark as Studied'}
        >
          {isCompleted ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Circle size={13} />}
          <span>{isCompleted ? 'Done' : 'Mark Done'}</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => onCopyLink(item, e)}
            title="Copy Link"
            className={`p-1.5 rounded-lg border transition ${
              copiedId === item.id 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
          </button>

          {hasEmbed ? (
            <button
              onClick={() => { onLogClick(item.id); onPreview(item); }}
              className="px-2.5 sm:px-3 py-1 bg-[#255A84] hover:bg-[#1a4261] text-white text-[11px] sm:text-xs font-bold rounded-lg shadow-2xs transition active:scale-95 flex items-center gap-1"
            >
              <Maximize2 size={11} /> Launch
            </button>
          ) : (
            <a
              href={item.fileUrl || item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onLogClick && onLogClick(item.id)}
              className="px-2.5 sm:px-3 py-1 bg-[#255A84] hover:bg-[#1a4261] text-white text-[11px] sm:text-xs font-bold rounded-lg shadow-2xs transition active:scale-95 flex items-center gap-1"
            >
              <ExternalLink size={11} /> Open
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Resource List Item Component (Compact Mode) ──
function StudentResourceListItem({
  item, bookmarks, completedItems, onBookmark, onToggleCompleted,
  onLogClick, onCopyLink, copiedId, onPreview, courseName
}) {
  const type = item.type || detectType(item.fileUrl || item.url);
  const isBookmarked = bookmarks.includes(item.id);
  const isCompleted = completedItems.includes(item.id);
  const hasEmbed = getEmbedUrl(item.fileUrl || item.url);

  return (
    <div className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/80 transition-colors ${
      isCompleted ? 'bg-emerald-50/20' : ''
    }`}>
      <div className="flex items-start gap-2.5 min-w-0">
        <button
          onClick={() => onToggleCompleted(item.id, item.title)}
          className={`p-0.5 rounded-lg transition shrink-0 mt-1 ${
            isCompleted ? 'text-emerald-600' : 'text-slate-300 hover:text-emerald-600'
          }`}
          title={isCompleted ? 'Completed' : 'Mark as Done'}
        >
          {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        </button>

        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${typeIconBox(type)}`}>
          <TypeIcon type={type} size={16} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full border ${typeBadgeStyle(type)}`}>
              {typeLabel(type)}
            </span>
            {courseName && (
              <span className="text-[9px] font-bold text-[#255A84] bg-blue-50 px-1.5 py-0.2 rounded">
                {courseName}
              </span>
            )}
            {item.isPinned && (
              <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                <Pin size={8} fill="currentColor" /> Pinned
              </span>
            )}
          </div>
          <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 truncate">{item.title}</h4>
          {item.description && <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{item.description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <button
          onClick={() => onBookmark(item.id)}
          className={`p-1.5 rounded-lg transition ${
            isBookmarked ? 'bg-amber-50 text-amber-500 border border-amber-200' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
          }`}
          title="Bookmark"
        >
          <Star size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
        </button>

        <button
          onClick={(e) => onCopyLink(item, e)}
          className={`p-1.5 rounded-lg border transition ${
            copiedId === item.id ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-400 border-slate-200 hover:text-slate-800'
          }`}
          title="Copy Link"
        >
          {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
        </button>

        {hasEmbed ? (
          <button
            onClick={() => { onLogClick(item.id); onPreview(item); }}
            className="px-2.5 py-1 bg-[#255A84] hover:bg-[#1c4566] text-white text-[11px] sm:text-xs font-bold rounded-lg shadow-2xs transition flex items-center gap-1"
          >
            <Maximize2 size={11} /> Preview
          </button>
        ) : (
          <a
            href={item.fileUrl || item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLogClick && onLogClick(item.id)}
            className="px-2.5 py-1 bg-[#255A84] hover:bg-[#1c4566] text-white text-[11px] sm:text-xs font-bold rounded-lg shadow-2xs transition flex items-center gap-1"
          >
            <ExternalLink size={11} /> Open
          </a>
        )}
      </div>
    </div>
  );
}
