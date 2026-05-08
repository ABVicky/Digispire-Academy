import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { FileText, Link2, Globe, ExternalLink, Search, BookOpen, Star } from 'lucide-react';

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

function TypeIcon({ type }) {
  if (type === 'pdf') return <FileText size={18} className="text-red-500" />;
  if (type === 'gdrive') return <Globe size={18} className="text-blue-500" />;
  if (type === 'video') return <Globe size={18} className="text-purple-500" />;
  return <Link2 size={18} className="text-blue-500" />;
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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Resources</h1>
        <p className="text-sm text-slate-500">Study materials & links shared by your instructors</p>
      </div>

      {/* Search + Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, subject…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84]"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => { setFilterCourse('all'); setShowBookmarksOnly(false); }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${filterCourse === 'all' && !showBookmarksOnly ? 'bg-[#255A84] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            All
          </button>
          <button
            onClick={() => { setShowBookmarksOnly(!showBookmarksOnly); setFilterCourse('all'); }}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition ${showBookmarksOnly ? 'bg-[#F48B1F] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Star size={11} /> Bookmarks
          </button>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => { setFilterCourse(c.id); setShowBookmarksOnly(false); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${filterCourse === c.id ? 'bg-[#255A84] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{showBookmarksOnly ? 'No bookmarked resources.' : search ? 'No resources match your search.' : 'No resources available yet.'}</p>
        </div>
      ) : useGroups ? (
        // Grouped by course
        <div className="space-y-6">
          {Object.entries(courseGroups).map(([courseId, items]) => (
            <div key={courseId}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BookOpen size={14} />
                {courseId === '__uncategorized__' ? 'General Resources' : getCourseName(courseId)}
                <span className="font-normal normal-case text-slate-400">({items.length})</span>
              </h2>
              <div className="space-y-2">
                {items.map(item => <ResourceCard key={item.id} item={item} bookmarks={bookmarks} onBookmark={toggleBookmark} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => <ResourceCard key={item.id} item={item} bookmarks={bookmarks} onBookmark={toggleBookmark} onLogClick={logClick} />)}
        </div>
      )}
    </div>
  );
}

function ResourceCard({ item, bookmarks, onBookmark, onLogClick }) {
  const type = item.type || detectType(item.fileUrl);
  const isBookmarked = bookmarks.includes(item.id);

  return (
    <a
      href={item.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-[#255A84]/30 transition-all group"
      onClick={() => onLogClick(item.id)}
    >
      <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
        <TypeIcon type={type} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm leading-snug group-hover:text-[#255A84] transition-colors truncate">
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.description}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge(type)}`}>
            {typeLabel(type)}
          </span>
          {item.subject && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
              {item.subject}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onBookmark(item.id); }}
          className={`p-1.5 rounded-lg transition ${isBookmarked ? 'text-[#F48B1F]' : 'text-slate-300 hover:text-[#F48B1F]'}`}
        >
          <Star size={15} fill={isBookmarked ? '#F48B1F' : 'none'} />
        </button>
        <ExternalLink size={14} className="text-slate-300 group-hover:text-[#255A84] transition-colors" />
      </div>
    </a>
  );
}
