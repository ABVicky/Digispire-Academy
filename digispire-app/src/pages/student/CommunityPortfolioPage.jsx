import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Globe, ExternalLink, Search, Megaphone, MousePointer2, 
  Layout, Briefcase, Sparkles, Loader2, Award, User
} from 'lucide-react';

const PROJECT_TYPES = [
  { id: 'seo', label: 'SEO Audit', icon: Search, color: 'text-blue-500' },
  { id: 'social', label: 'SMM Campaign', icon: Megaphone, color: 'text-purple-500' },
  { id: 'ads', label: 'PPC / Meta Ads', icon: MousePointer2, color: 'text-emerald-500' },
  { id: 'design', label: 'Web Design', icon: Layout, color: 'text-orange-500' }
];

export default function CommunityPortfolioPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');

  useEffect(() => {
    const fetchAllPortfolios = async () => {
      try {
        const q = collection(db, 'portfolios');
        const snap = await getDocs(q);
        const allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort locally to avoid index requirement (especially for new collections)
        setProjects(allProjects.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        }));
      } catch (err) { 
        console.error("Error fetching community portfolios:", err); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchAllPortfolios();
  }, []);

  const filtered = projects.filter(p => activeType === 'all' || p.type === activeType);

  return (
    <div className="space-y-6 pb-20">
      <div className="px-2">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Community Portfolio</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Inspired by work from fellow marketers at DIGISPIRE</p>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-2 py-2">
        <button
          onClick={() => setActiveType('all')}
          className={`flex-shrink-0 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeType === 'all' ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'bg-white text-slate-500 border border-slate-50 hover:bg-slate-50'}`}
        >
          All Projects
        </button>
        {PROJECT_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveType(t.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeType === t.id ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'bg-white text-slate-500 border border-slate-50 hover:bg-slate-50'}`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#255A84]" size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Award size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 font-medium text-sm">No projects published in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2">
          {filtered.map(p => {
            const typeInfo = PROJECT_TYPES.find(t => t.id === p.type) || PROJECT_TYPES[0];
            return (
              <div key={p.id} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-6">
                  <div className={`h-12 w-12 rounded-2xl ${typeInfo.color} bg-opacity-10 flex items-center justify-center`}>
                    <typeInfo.icon size={24} />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{typeInfo.label}</span>
                    <span className="text-[10px] font-bold text-[#255A84] mt-1 flex items-center gap-1">
                      <User size={10} /> {p.studentName || 'Marketer'}
                    </span>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 leading-tight line-clamp-1">{p.title}</h3>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed flex-1 line-clamp-2">{p.description || 'Campaign submission for DIGISPIRE Portfolio.'}</p>
                
                <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <a 
                    href={p.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 group/link"
                  >
                    <div className="h-8 w-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center group-hover/link:text-[#255A84] group-hover/link:bg-[#255A84]/5 transition-colors">
                      <Globe size={14} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">
                      {(() => {
                        try { return new URL(p.url).hostname; }
                        catch { return 'View Live'; }
                      })()}
                    </span>
                  </a>
                  <a 
                    href={p.url} target="_blank" rel="noopener noreferrer"
                    className="h-10 px-4 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-[#255A84] hover:text-white transition-all"
                  >
                    Details <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
