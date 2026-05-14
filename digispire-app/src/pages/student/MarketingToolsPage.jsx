import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Search, Globe, MousePointer2, Megaphone, BarChart3, 
  Mail, ExternalLink, Sparkles, Zap, Smartphone, Layout,
  Loader2
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Tools', icon: Zap },
  { id: 'seo', label: 'SEO & Search', icon: Search },
  { id: 'social', label: 'Social Media', icon: Megaphone },
  { id: 'ads', label: 'Paid Ads', icon: MousePointer2 },
  { id: 'content', label: 'Content', icon: Globe },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'email', label: 'Email & CRM', icon: Mail }
];

export default function MarketingToolsPage() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const snap = await getDocs(collection(db, 'marketing_tools'));
        setTools(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchTools();
  }, []);

  const filteredTools = tools.filter(tool => {
    const matchesTab = activeTab === 'all' || tool.categoryId === activeTab;
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="px-2">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Marketing Tools</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Professional tools curated by your educators</p>
      </div>

      {/* Search Bar */}
      <div className="px-2">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#255A84] transition-colors" size={20} />
          <input 
            type="text"
            placeholder="Search for tools, strategies, or platforms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#255A84]/20 transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-2 py-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === cat.id ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'bg-white text-slate-500 border border-slate-50 hover:bg-slate-50'}`}
          >
            <cat.icon size={14} />
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#255A84]" size={32} /></div>
      ) : filteredTools.length === 0 ? (
        <div className="py-20 text-center">
          <Sparkles size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 font-medium text-sm">No tools found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2">
          {filteredTools.map(tool => {
            const cat = CATEGORIES.find(c => c.id === tool.categoryId) || CATEGORIES[0];
            return (
              <div key={tool.id} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-[#255A84] group-hover:scale-110 transition-transform duration-300">
                    <cat.icon size={24} />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] bg-slate-50 px-3 py-1.5 rounded-full">{cat.label}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 leading-tight">{tool.name}</h3>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed flex-1">{tool.description}</p>
                <div className="mt-8 pt-6 border-t border-slate-50">
                  <a 
                    href={tool.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between group/btn"
                  >
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-[#255A84] uppercase tracking-widest">Open Tool</span>
                       <div className="h-1 w-1 rounded-full bg-[#255A84]/30" />
                       <span className="text-[9px] font-medium text-slate-400 truncate max-w-[120px]">{new URL(tool.url).hostname}</span>
                    </div>
                    <div className="h-10 w-10 bg-[#255A84]/5 text-[#255A84] rounded-xl flex items-center justify-center group-hover/btn:bg-[#255A84] group-hover/btn:text-white transition-all duration-300">
                       <ExternalLink size={16} />
                    </div>
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
