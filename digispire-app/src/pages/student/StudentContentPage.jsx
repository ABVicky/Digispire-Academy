import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { FileText, Link2, Globe, ExternalLink, Search, BookOpen, Star, Video, Eye } from 'lucide-react';

function detectType(url) {
  if (!url) return 'link';
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) return 'gdrive';
  if (lower.includes('.pdf') || lower.includes('pdf')) return 'pdf';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'video';
  return 'link';
}

function typeLabel(type) {
  const map = { pdf: 'PDF Document', gdrive: 'Google Drive', video: 'Video Session', link: 'Resource Link' };
  return map[type] || 'Resource';
}

function typeBadge(type) {
  const map = {
    pdf: 'bg-rose-50 border-rose-100 text-rose-600',
    gdrive: 'bg-blue-50 border-blue-100 text-blue-600',
    video: 'bg-purple-50 border-purple-100 text-purple-600',
    link: 'bg-slate-50 border-slate-100 text-slate-600',
  };
  return map[type] || map.link;
}

function TypeIcon({ type }) {
  if (type === 'pdf') return <FileText size={20} className="text-rose-500" />;
  if (type === 'gdrive') return <Globe size={20} className="text-blue-500" />;
  if (type === 'video') return <Video size={20} className="text-purple-500" />;
  return <Link2 size={20} className="text-slate-500" />;
}

export default function StudentContentPage() {
  const [contents, setContents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
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
        setContents(items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      } catch (err) { console.error(err); }
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

  const getCourseName = (id) => courses.find(c => c.id === id)?.name || '';

  const filtered = contents.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q || item.title?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q) || item.subject?.toLowerCase().includes(q);
    const matchCourse = filterCourse === 'all' || item.courseId === filterCourse;
    const matchBookmark = !showBookmarksOnly || bookmarks.includes(item.id);
    return matchSearch && matchCourse && matchBookmark;
  });

  // Group by course
  const courseGroups = {};
  if (filterCourse === 'all' && !search && !showBookmarksOnly) {
    filtered.forEach(item => {
      const key = item.courseId || '__uncategorized__';
      if (!courseGroups[key]) courseGroups[key] = [];
      courseGroups[key].push(item);
    });
  }
  const useGroups = filterCourse === 'all' && !search && !showBookmarksOnly;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Resources Library</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Study materials, downloads, & links shared by your instructors</p>
      </div>

      {/* Search + Filters Controls */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search resources by title, subject, description..."
            className="input-premium pl-10 text-xs"
          />
        </div>

        {/* Filter pills scroll row */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          <button
            onClick={() => { setFilterCourse('all'); setShowBookmarksOnly(false); }}
            className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${filterCourse === 'all' && !showBookmarksOnly ? 'bg-[#255A84] text-white shadow-sm' : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'}`}
          >
            All Resources
          </button>
          <button
            onClick={() => { setShowBookmarksOnly(!showBookmarksOnly); setFilterCourse('all'); }}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${showBookmarksOnly ? 'bg-[#F48B1F] text-white shadow-sm' : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'}`}
          >
            <Star size={11} fill={showBookmarksOnly ? 'currentColor' : 'none'} /> Bookmarks
          </button>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => { setFilterCourse(c.id); setShowBookmarksOnly(false); }}
              className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${filterCourse === c.id ? 'bg-[#255A84] text-white shadow-sm' : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        /* Premium Card Skeletons */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-6 w-16 bg-slate-200 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                <div className="h-3.5 w-5/6 bg-slate-200 rounded" />
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                <div className="h-4 w-12 bg-slate-200 rounded" />
                <div className="flex gap-2">
                  <div className="h-6 w-6 bg-slate-200 rounded-lg" />
                  <div className="h-6 w-6 bg-slate-200 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
          <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-bold text-sm">No resources found.</p>
          <p className="text-xs text-slate-400 mt-1">
            {showBookmarksOnly 
              ? 'Bookmark study materials to save them here for quick access.' 
              : 'Materials shared by your educators will appear here.'}
          </p>
        </div>
      ) : useGroups ? (
        /* Grouped by Course Lists */
        <div className="space-y-8">
          {Object.entries(courseGroups).map(([courseId, items]) => (
            <div key={courseId} className="space-y-3">
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-[#255A84]" />
                {courseId === '__uncategorized__' ? 'General Resources' : getCourseName(courseId)}
                <span className="font-medium text-slate-300">({items.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map(item => (
                  <ResourceCard
                    key={item.id}
                    item={item}
                    bookmarks={bookmarks}
                    onBookmark={toggleBookmark}
                    onLogClick={logClick}
                    courseName={getCourseName(item.courseId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat Grid View when Searching or Filtering */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(item => (
            <ResourceCard
              key={item.id}
              item={item}
              bookmarks={bookmarks}
              onBookmark={toggleBookmark}
              onLogClick={logClick}
              courseName={getCourseName(item.courseId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceCard({ item, bookmarks, onBookmark, onLogClick, courseName }) {
  const type = item.type || detectType(item.fileUrl);
  const isBookmarked = bookmarks.includes(item.id);

  return (
    <div className="bg-white rounded-2xl border border-slate-100/80 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#255A84]/20 hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden">
      {/* Upper Content */}
      <div className="p-5 space-y-3">
        {/* Course Name / Type Badge */}
        <div className="flex items-center justify-between gap-2">
          {courseName ? (
            <span className="text-[10px] font-black uppercase tracking-wider text-[#255A84] truncate max-w-[140px]" title={courseName}>
              {courseName}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
              General
            </span>
          )}

          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg border shrink-0 ${typeBadge(type)}`}>
            {typeLabel(type)}
          </span>
        </div>

        {/* Title and Description */}
        <div className="space-y-1.5">
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLogClick && onLogClick(item.id)}
            className="font-bold text-slate-800 text-sm leading-snug group-hover:text-[#255A84] transition-colors line-clamp-2 block hover:underline"
          >
            {item.title}
          </a>
          {item.description && (
            <p className="text-xs text-slate-400 font-medium line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {item.subject && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 uppercase tracking-wide">
              {item.subject}
            </span>
          )}
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1" title="Access Counts">
            <Eye size={12} className="text-slate-300 shrink-0" />
            <span>{item.clicks || 0}</span>
          </span>
          {item.createdAt && (
            <span className="text-slate-300 font-medium">
              {new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onBookmark(item.id); }}
            className={`p-1.5 rounded-lg transition-all active:scale-90 cursor-pointer ${
              isBookmarked ? 'text-[#F48B1F] bg-[#F48B1F]/5' : 'text-slate-300 hover:text-[#F48B1F] hover:bg-slate-100/50'
            }`}
            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Resource'}
          >
            <Star size={14} fill={isBookmarked ? '#F48B1F' : 'none'} strokeWidth={isBookmarked ? 1.5 : 2} />
          </button>
          
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLogClick && onLogClick(item.id)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-[#255A84] hover:bg-slate-100/50 transition cursor-pointer"
            title="Launch Resource"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
