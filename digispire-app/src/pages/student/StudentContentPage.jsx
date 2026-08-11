import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  FileText, Globe, ExternalLink, Search, BookOpen, Star, Video,
  Copy, Check, Play, Maximize2, Pin, X
} from 'lucide-react';

function detectType(url) {
  if (!url) return 'link';
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) return 'gdrive';
  if (lower.includes('.pdf') || lower.includes('pdf')) return 'pdf';
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com')) return 'video';
  return 'link';
}

function typeLabel(type) {
  const map = { pdf: 'PDF Document', gdrive: 'Google Drive', video: 'Video Lecture', link: 'Resource Link' };
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
  return <Globe size={size} className="text-[#255A84]" />;
}

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
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pinned', 'pdf', 'gdrive', 'video', 'link'
  const [copiedId, setCopiedId] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null);

  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ds_bookmarks') || '[]'); } catch { return []; }
  });
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
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
      } catch (err) { console.error('Error fetching resources:', err); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const toggleBookmark = (id) => {
    const updated = bookmarks.includes(id)
      ? bookmarks.filter(b => b !== id)
      : [...bookmarks, id];
    setBookmarks(updated);
    localStorage.setItem('ds_bookmarks', JSON.stringify(updated));
  };

  const logClick = async (id) => {
    try {
      await updateDoc(doc(db, 'content', id), {
        clicks: increment(1),
        lastAccessed: serverTimestamp()
      });
    } catch (err) { console.error('Error logging click:', err); }
  };

  const handleCopyLink = (item, e) => {
    if (e) e.stopPropagation();
    const link = item.fileUrl || item.url;
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCourseName = (id) => courses.find(c => c.id === id)?.name || '';

  const filtered = useMemo(() => {
    return contents.filter(item => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.subject?.toLowerCase().includes(q);

      const matchCourse = filterCourse === 'all' || item.courseId === filterCourse;
      const matchBookmark = !showBookmarksOnly || bookmarks.includes(item.id);
      const type = item.type || detectType(item.fileUrl || item.url);

      let matchTab = true;
      if (activeTab === 'pinned') matchTab = !!item.isPinned;
      else if (activeTab !== 'all') matchTab = type === activeTab;

      return matchSearch && matchCourse && matchBookmark && matchTab;
    });
  }, [contents, search, filterCourse, showBookmarksOnly, bookmarks, activeTab]);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Title Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#255A84] via-[#1f4b6e] to-[#14334c] text-white flex items-center justify-center shadow-md shadow-[#255A84]/20">
          <BookOpen size={22} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">Student Learning Hub</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Stream video lectures, preview PDF notes, and access course documents</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'All Resources' },
          { id: 'pinned', label: '📌 Pinned Notes' },
          { id: 'video', label: '🎥 Video Lectures' },
          { id: 'pdf', label: '📄 PDF Guides' },
          { id: 'gdrive', label: '📁 Drive Folders' },
          { id: 'link', label: '🔗 Web Links' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setShowBookmarksOnly(false); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id && !showBookmarksOnly
                ? 'bg-[#255A84] text-white shadow-md shadow-[#255A84]/15'
                : 'text-slate-600 hover:bg-slate-100/80'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <button
          onClick={() => { setShowBookmarksOnly(!showBookmarksOnly); setActiveTab('all'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            showBookmarksOnly ? 'bg-[#F48B1F] text-white shadow-md shadow-[#F48B1F]/20' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Star size={12} fill={showBookmarksOnly ? 'currentColor' : 'none'} />
          Bookmarks ({bookmarks.length})
        </button>
      </div>

      {/* Search & Course Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search study materials by title, subject tag, description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#255A84] focus:outline-none transition-all"
          />
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

      {/* Content Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
          <p className="text-xs text-slate-400 font-bold">Loading study resources...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2">
          <BookOpen size={48} className="mx-auto mb-2 opacity-20 text-slate-500" />
          <p className="font-bold text-sm text-slate-700">No Resources Available</p>
          <p className="text-xs text-slate-400">
            {showBookmarksOnly
              ? 'Click the star icon on any resource card to save it to your bookmarks.'
              : 'Study materials published by your instructors will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(item => (
            <StudentResourceCard
              key={item.id}
              item={item}
              bookmarks={bookmarks}
              onBookmark={toggleBookmark}
              onLogClick={logClick}
              onCopyLink={handleCopyLink}
              copiedId={copiedId}
              onPreview={setPreviewMedia}
              courseName={getCourseName(item.courseId)}
            />
          ))}
        </div>
      )}

      {/* Media Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-800 shadow-2xl text-white font-sans">
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

            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
              <p className="text-slate-400 text-xs truncate max-w-md">{previewMedia.description || 'No description provided.'}</p>
              <a
                href={previewMedia.fileUrl || previewMedia.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logClick(previewMedia.id)}
                className="px-4 py-2 bg-[#255A84] hover:bg-[#1c4566] text-white font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <ExternalLink size={14} /> Open External
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentResourceCard({ item, bookmarks, onBookmark, onLogClick, onCopyLink, copiedId, onPreview, courseName }) {
  const type = item.type || detectType(item.fileUrl || item.url);
  const isBookmarked = bookmarks.includes(item.id);
  const youtubeThumb = getYoutubeThumbnail(item.fileUrl || item.url);
  const hasEmbed = getEmbedUrl(item.fileUrl || item.url);

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden group ${
      item.isPinned ? 'border-amber-300/80 shadow-md shadow-amber-500/5' : 'border-slate-100 shadow-sm hover:shadow-md hover:border-[#255A84]/20'
    }`}>
      {/* Pinned Ribbon Badge */}
      {item.isPinned && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-extrabold px-3 py-0.5 flex items-center justify-center gap-1 uppercase tracking-widest shadow-xs">
          <Pin size={10} fill="white" />
          Featured Note
        </div>
      )}

      {/* Video Thumbnail / Banner Preview */}
      {youtubeThumb ? (
        <div
          onClick={() => { onLogClick(item.id); onPreview(item); }}
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
            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${typeBadgeStyle(type)}`}>
              {typeLabel(type)}
            </span>
          </div>

          <button
            onClick={() => onBookmark(item.id)}
            className={`p-1.5 rounded-xl transition active:scale-90 ${
              isBookmarked ? 'bg-[#F48B1F]/10 text-[#F48B1F]' : 'bg-white/80 text-slate-400 hover:text-[#F48B1F]'
            }`}
            title={isBookmarked ? 'Remove Bookmark' : 'Save to Bookmarks'}
          >
            <Star size={15} fill={isBookmarked ? '#F48B1F' : 'none'} strokeWidth={isBookmarked ? 1.5 : 2} />
          </button>
        </div>
      )}

      {/* Card Content */}
      <div className="p-5 space-y-3 flex-1">
        <div>
          <a
            href={item.fileUrl || item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLogClick && onLogClick(item.id)}
            className="font-bold text-slate-800 text-sm leading-snug group-hover:text-[#255A84] transition-colors line-clamp-2 block hover:underline"
          >
            {item.title}
          </a>
          {item.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {courseName ? (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-[#255A84]">
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
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 text-xs">
        {hasEmbed ? (
          <button
            onClick={() => { onLogClick(item.id); onPreview(item); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#255A84] text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 hover:bg-[#1a4261]"
          >
            <Maximize2 size={13} /> Launch Media
          </button>
        ) : (
          <a
            href={item.fileUrl || item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLogClick && onLogClick(item.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#255A84] hover:bg-[#1a4261] text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95"
          >
            <ExternalLink size={13} /> Open Link
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
