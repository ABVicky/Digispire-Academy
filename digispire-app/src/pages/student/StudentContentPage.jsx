import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, getDocs, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  FileText, Globe, ExternalLink, Search, BookOpen, Star, Video,
  Copy, Check, Play, Maximize2, Pin, X, CheckCircle2, Circle,
  Sparkles, Filter, Clock, Tag, Presentation, Code2, FolderGit2,
  Share2, ArrowUpRight, Award, Compass, Layers, CheckCheck,
  Flame, LayoutGrid, ListFilter, RotateCcw, AlertCircle
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptic';

// Smart Resource Type Detector
function detectType(url) {
  if (!url) return 'link';
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com/folder')) return 'gdrive';
  if (lower.includes('docs.google.com/presentation') || lower.includes('slideshare.net') || lower.includes('canva.com/design') || lower.includes('.ppt') || lower.includes('.pptx')) return 'slides';
  if (lower.includes('github.com') || lower.includes('gitlab.com') || lower.includes('codesandbox.io') || lower.includes('replit.com') || lower.includes('codepen.io')) return 'code';
  if (lower.includes('.pdf') || lower.includes('pdf')) return 'pdf';
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com') || lower.includes('loom.com')) return 'video';
  return 'link';
}

function typeLabel(type) {
  const map = {
    pdf: 'PDF Guide & Notes',
    gdrive: 'Drive Folder & Assets',
    video: 'Video Masterclass',
    slides: 'Presentation Slides',
    code: 'Code & Repository',
    link: 'Web Reference'
  };
  return map[type] || 'Resource Link';
}

function typeBadgeStyle(type) {
  const map = {
    pdf: 'bg-rose-50 text-rose-700 border-rose-200/80',
    gdrive: 'bg-sky-50 text-sky-700 border-sky-200/80',
    video: 'bg-purple-50 text-purple-700 border-purple-200/80',
    slides: 'bg-amber-50 text-amber-700 border-amber-200/80',
    code: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    link: 'bg-blue-50 text-blue-700 border-blue-200/80',
  };
  return map[type] || map.link;
}

function typeIconColor(type) {
  const map = {
    pdf: 'text-rose-600 bg-rose-50 border-rose-100',
    gdrive: 'text-sky-600 bg-sky-50 border-sky-100',
    video: 'text-purple-600 bg-purple-50 border-purple-100',
    slides: 'text-amber-600 bg-amber-50 border-amber-100',
    code: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    link: 'text-[#255A84] bg-blue-50 border-blue-100',
  };
  return map[type] || map.link;
}

function typeHeaderGradient(type) {
  const map = {
    pdf: 'from-rose-500/10 via-rose-500/5 to-transparent text-rose-600',
    gdrive: 'from-sky-500/10 via-sky-500/5 to-transparent text-sky-600',
    video: 'from-purple-500/10 via-purple-500/5 to-transparent text-purple-600',
    slides: 'from-amber-500/10 via-amber-500/5 to-transparent text-amber-600',
    code: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-600',
    link: 'from-blue-500/10 via-blue-500/5 to-transparent text-blue-600',
  };
  return map[type] || map.link;
}

function TypeIcon({ type, size = 18 }) {
  if (type === 'pdf') return <FileText size={size} className="text-rose-600" />;
  if (type === 'gdrive') return <FolderGit2 size={size} className="text-sky-600" />;
  if (type === 'video') return <Video size={size} className="text-purple-600" />;
  if (type === 'slides') return <Presentation size={size} className="text-amber-600" />;
  if (type === 'code') return <Code2 size={size} className="text-emerald-600" />;
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
  if (url.includes('docs.google.com/presentation/d/')) {
    const id = url.split('/presentation/d/')[1]?.split('/')[0];
    return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&delayms=3000`;
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
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'bookmarks', 'completed', 'pinned', 'video', 'pdf', 'slides', 'code', 'gdrive', 'link'
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

  // Extract all unique subjects / tags for cloud
  const allSubjects = useMemo(() => {
    const subjects = new Set();
    contents.forEach(item => {
      if (item.subject && item.subject.trim()) {
        subjects.add(item.subject.trim());
      }
    });
    return Array.from(subjects);
  }, [contents]);

  // Overall Learning Stats
  const totalCount = contents.length;
  const completedCount = contents.filter(c => completedItems.includes(c.id)).length;
  const bookmarkedCount = contents.filter(c => bookmarks.includes(c.id)).length;
  const videoCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'video').length;
  const pdfCount = contents.filter(c => (c.type || detectType(c.fileUrl || c.url)) === 'pdf').length;
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
        const matchSubject = selectedSubject === 'all' || item.subject === selectedSubject;

        let matchTab = true;
        if (activeTab === 'bookmarks') matchTab = bookmarks.includes(item.id);
        else if (activeTab === 'completed') matchTab = completedItems.includes(item.id);
        else if (activeTab === 'pinned') matchTab = !!item.isPinned;
        else if (activeTab !== 'all') matchTab = type === activeTab;

        return matchSearch && matchCourse && matchSubject && matchTab;
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
  }, [contents, search, filterCourse, selectedSubject, activeTab, sortBy, bookmarks, completedItems, courses]);

  const hasActiveFilters = search || filterCourse !== 'all' || selectedSubject !== 'all' || activeTab !== 'all';

  const resetAllFilters = () => {
    setSearch('');
    setFilterCourse('all');
    setSelectedSubject('all');
    setActiveTab('all');
    setSortBy('newest');
  };

  return (
    <div className="space-y-6 pb-16 font-sans select-none sm:select-auto">
      {/* ── Toast Notification for Completed Study Item ── */}
      {recentlyCompletedToast && (
        <div className="fixed bottom-20 right-4 sm:right-8 z-50 bg-emerald-950/90 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCheck size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-300">Milestone Unlocked! 🎉</p>
            <p className="text-[11px] text-slate-300 truncate max-w-xs">{recentlyCompletedToast}</p>
          </div>
        </div>
      )}

      {/* ── Hero Learning & Study Dashboard Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E3A5F] to-[#255A84] text-white p-6 sm:p-8 shadow-xl shadow-[#255A84]/15 border border-white/10">
        {/* Subtle decorative background circles */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#F48B1F]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-blue-200 tracking-wider uppercase backdrop-blur-md">
              <Sparkles size={12} className="text-amber-400" />
              <span>Digispire Learning Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Study Materials & Resources
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Explore lecture recordings, masterclass slides, downloadable cheat sheets, and coding repositories curated for your cohort.
            </p>

            {/* Quick Hero Stat Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={() => { setActiveTab('all'); setFilterCourse('all'); }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold transition flex items-center gap-1.5"
              >
                <BookOpen size={13} className="text-blue-300" />
                <span>{totalCount} Total Items</span>
              </button>

              <button
                onClick={() => setActiveTab('video')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Video size={13} className="text-purple-300" />
                <span>{videoCount} Lectures</span>
              </button>

              <button
                onClick={() => setActiveTab('pdf')}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold transition flex items-center gap-1.5"
              >
                <FileText size={13} className="text-rose-300" />
                <span>{pdfCount} PDF Guides</span>
              </button>

              <button
                onClick={() => setActiveTab('bookmarks')}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-xs font-bold text-amber-300 transition flex items-center gap-1.5"
              >
                <Star size={13} fill="currentColor" />
                <span>{bookmarkedCount} Saved</span>
              </button>
            </div>
          </div>

          {/* Gamified Study Progress Tracker Widget */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/15 shrink-0 min-w-[260px] lg:max-w-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award size={16} className="text-amber-400" />
                <span className="text-xs font-bold text-white tracking-wide">Your Study Progress</span>
              </div>
              <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                {progressPercent}% Done
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10">
              <div
                className="bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.max(progressPercent, 4)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
              <span>{completedCount} of {totalCount} completed</span>
              {progressPercent >= 100 ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Flame size={12} /> Mastered!
                </span>
              ) : (
                <span className="text-slate-400">Keep learning 🚀</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search, Course Track & Sorting Bar ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/90 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by topic, keyword, course name, or tags..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#255A84] focus:ring-2 focus:ring-[#255A84]/10 focus:outline-none transition-all"
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

          {/* Course Selector Dropdown */}
          <div className="flex items-center gap-2">
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

            {/* Sort Dropdown */}
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

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'compact' ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Compact List View"
              >
                <ListFilter size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Category Pill Tabs ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {[
            { id: 'all', label: 'All Items', icon: Layers, count: totalCount },
            { id: 'bookmarks', label: 'Saved Bookmarks', icon: Star, count: bookmarkedCount, highlight: true },
            { id: 'completed', label: 'Completed', icon: CheckCircle2, count: completedCount },
            { id: 'pinned', label: '📌 Pinned', count: contents.filter(c => c.isPinned).length },
            { id: 'video', label: '🎥 Lectures', count: videoCount },
            { id: 'pdf', label: '📄 PDF Notes', count: pdfCount },
            { id: 'slides', label: '📊 Slides' },
            { id: 'code', label: '💻 Code Repos' },
            { id: 'gdrive', label: '📁 Drive Folders' },
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
                      ? 'bg-[#F48B1F] text-white shadow-md shadow-[#F48B1F]/20'
                      : tab.id === 'completed'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-[#255A84] text-white shadow-md shadow-[#255A84]/15'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-100'
                }`}
              >
                {TabIcon && <TabIcon size={13} className={isActive && tab.id === 'bookmarks' ? 'fill-white' : ''} />}
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

        {/* ── Dynamic Subject Tags Cloud ── */}
        {allSubjects.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Tag size={11} /> Topic Tags:
            </span>
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                selectedSubject === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Topics
            </button>
            {allSubjects.map(sub => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(selectedSubject === sub ? 'all' : sub)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                  selectedSubject === sub
                    ? 'bg-[#255A84] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                #{sub}
              </button>
            ))}
          </div>
        )}

        {/* Filter Reset Strip if filters active */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{filtered.length}</strong> matching resources
            </span>
            <button
              onClick={resetAllFilters}
              className="text-[#255A84] font-bold hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} /> Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Content Grid / List Area ── */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-100 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
          <div className="animate-spin rounded-full h-9 w-9 border-4 border-[#255A84] border-t-transparent" />
          <p className="text-xs text-slate-400 font-bold">Assembling your study resources...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-4 text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            {activeTab === 'bookmarks' ? (
              <Star size={32} className="text-amber-400" />
            ) : activeTab === 'completed' ? (
              <CheckCircle2 size={32} className="text-emerald-500" />
            ) : (
              <BookOpen size={32} className="text-slate-400" />
            )}
          </div>
          <h3 className="font-extrabold text-base text-slate-800">
            {activeTab === 'bookmarks'
              ? 'No Bookmarks Saved Yet'
              : activeTab === 'completed'
              ? 'No Completed Items Yet'
              : 'No Matching Resources Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === 'bookmarks'
              ? 'Click the star icon on any lecture or study guide card to bookmark it for quick access during exam prep.'
              : activeTab === 'completed'
              ? 'Tick the checkbox on resources you have finished studying to track your learning progress.'
              : 'Try clearing your search query or selecting a different course filter.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="px-4 py-2 bg-[#255A84] text-white text-xs font-bold rounded-xl shadow-md transition hover:bg-[#1a4261] inline-flex items-center gap-1.5"
            >
              <RotateCcw size={13} /> Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Modern Grid Layout ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleBookmark(previewMedia.id)}
                  className={`p-2 rounded-xl border transition ${
                    bookmarks.includes(previewMedia.id)
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title={bookmarks.includes(previewMedia.id) ? 'Remove Bookmark' : 'Save Bookmark'}
                >
                  <Star size={16} fill={bookmarks.includes(previewMedia.id) ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => setPreviewMedia(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                >
                  <X size={20} />
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
                  <div className="h-12 w-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <ExternalLink size={24} />
                  </div>
                  <p>In-app embed preview is not available for this link type.</p>
                  <a
                    href={previewMedia.fileUrl || previewMedia.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => logClick(previewMedia.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#255A84] hover:bg-[#1c4566] text-white font-bold rounded-xl transition"
                  >
                    <ExternalLink size={14} /> Open in New Window
                  </a>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions & Details */}
            <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                {previewMedia.description && (
                  <p className="text-slate-300 text-xs line-clamp-2 leading-relaxed">{previewMedia.description}</p>
                )}
                {previewMedia.subject && (
                  <span className="inline-block mt-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                    #{previewMedia.subject}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleCompleted(previewMedia.id, previewMedia.title)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                    completedItems.includes(previewMedia.id)
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  <CheckCircle2 size={14} className={completedItems.includes(previewMedia.id) ? 'text-emerald-400' : ''} />
                  {completedItems.includes(previewMedia.id) ? 'Studied / Completed' : 'Mark as Studied'}
                </button>

                <a
                  href={previewMedia.fileUrl || previewMedia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logClick(previewMedia.id)}
                  className="px-4 py-2 bg-[#255A84] hover:bg-[#1c4566] text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md"
                >
                  <ExternalLink size={14} /> Open Link
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Resource Card Component (Grid) ──
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
    <div className={`bg-white rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1 hover:shadow-xl ${
      isCompleted
        ? 'border-emerald-200/80 shadow-xs bg-emerald-500/[0.01]'
        : item.isPinned
        ? 'border-amber-300/90 shadow-md shadow-amber-500/5'
        : 'border-slate-200/80 shadow-xs hover:border-[#255A84]/30'
    }`}>
      {/* Pinned Ribbon Badge */}
      {item.isPinned && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-3 py-0.5 flex items-center justify-center gap-1 uppercase tracking-widest shadow-xs">
          <Pin size={10} fill="white" />
          Featured Cohort Note
        </div>
      )}

      {/* Video Thumbnail / Banner Preview */}
      {youtubeThumb ? (
        <div
          onClick={() => { onLogClick(item.id); onPreview(item); }}
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
            <Video size={10} /> Watch Masterclass
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

          <div className="flex items-center gap-1">
            {/* Completion Checkmark */}
            <button
              onClick={() => onToggleCompleted(item.id, item.title)}
              className={`p-1.5 rounded-xl transition ${
                isCompleted ? 'text-emerald-600 bg-emerald-50' : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50/50'
              }`}
              title={isCompleted ? 'Completed (Click to uncheck)' : 'Mark as Studied'}
            >
              {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            </button>

            {/* Bookmark Star */}
            <button
              onClick={() => onBookmark(item.id)}
              className={`p-1.5 rounded-xl transition ${
                isBookmarked ? 'bg-[#F48B1F]/10 text-[#F48B1F]' : 'text-slate-300 hover:text-[#F48B1F] hover:bg-amber-50/50'
              }`}
              title={isBookmarked ? 'Remove Bookmark' : 'Save to Bookmarks'}
            >
              <Star size={16} fill={isBookmarked ? '#F48B1F' : 'none'} strokeWidth={isBookmarked ? 1.5 : 2} />
            </button>
          </div>
        </div>
      )}

      {/* Card Content Body */}
      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div>
          <a
            href={item.fileUrl || item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLogClick && onLogClick(item.id)}
            className="font-extrabold text-slate-800 text-sm leading-snug group-hover:text-[#255A84] transition-colors line-clamp-2 block"
          >
            {item.title}
          </a>
          {item.description && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Badges & Tags */}
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
          {isCompleted && (
            <span className="ml-auto text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 flex items-center gap-1">
              <Check size={11} strokeWidth={3} /> Done
            </span>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2 text-xs">
        {hasEmbed ? (
          <button
            onClick={() => { onLogClick(item.id); onPreview(item); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#255A84] text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 hover:bg-[#1a4261]"
          >
            <Maximize2 size={13} /> Launch Preview
          </button>
        ) : (
          <a
            href={item.fileUrl || item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLogClick && onLogClick(item.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#255A84] hover:bg-[#1a4261] text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95"
          >
            <ExternalLink size={13} /> Open Resource
          </a>
        )}

        <button
          onClick={(e) => onCopyLink(item, e)}
          title="Copy Link"
          className={`p-2 rounded-xl border transition ${
            copiedId === item.id 
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
              : 'bg-white text-slate-500 border-slate-200/80 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
        </button>
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
    <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors ${
      isCompleted ? 'bg-emerald-50/20' : ''
    }`}>
      <div className="flex items-start gap-3 min-w-0">
        <button
          onClick={() => onToggleCompleted(item.id, item.title)}
          className={`p-1 rounded-lg transition shrink-0 mt-0.5 ${
            isCompleted ? 'text-emerald-600' : 'text-slate-300 hover:text-emerald-600'
          }`}
          title={isCompleted ? 'Completed' : 'Mark as Done'}
        >
          {isCompleted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>

        <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border ${typeIconColor(type)}`}>
          <TypeIcon type={type} size={18} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeBadgeStyle(type)}`}>
              {typeLabel(type)}
            </span>
            {courseName && (
              <span className="text-[10px] font-bold text-[#255A84] bg-blue-50 px-2 py-0.5 rounded-md">
                {courseName}
              </span>
            )}
            {item.subject && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                #{item.subject}
              </span>
            )}
            {item.isPinned && (
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 flex items-center gap-1">
                <Pin size={9} fill="currentColor" /> Pinned
              </span>
            )}
          </div>
          <h4 className="font-extrabold text-slate-800 text-sm mt-1 truncate">{item.title}</h4>
          {item.description && <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{item.description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <button
          onClick={() => onBookmark(item.id)}
          className={`p-2 rounded-xl transition ${
            isBookmarked ? 'bg-amber-50 text-amber-500 border border-amber-200' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
          }`}
          title="Bookmark"
        >
          <Star size={15} fill={isBookmarked ? 'currentColor' : 'none'} />
        </button>

        <button
          onClick={(e) => onCopyLink(item, e)}
          className={`p-2 rounded-xl border transition ${
            copiedId === item.id ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-500 border-slate-200/80 hover:text-slate-800'
          }`}
          title="Copy Link"
        >
          {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
        </button>

        {hasEmbed ? (
          <button
            onClick={() => { onLogClick(item.id); onPreview(item); }}
            className="px-3.5 py-1.5 bg-[#255A84] hover:bg-[#1c4566] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Maximize2 size={13} /> Preview
          </button>
        ) : (
          <a
            href={item.fileUrl || item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLogClick && onLogClick(item.id)}
            className="px-3.5 py-1.5 bg-[#255A84] hover:bg-[#1c4566] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <ExternalLink size={13} /> Open
          </a>
        )}
      </div>
    </div>
  );
}
