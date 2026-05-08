import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Globe, ExternalLink, Trash2, 
  Layout, MousePointer2, Megaphone, Search,
  Briefcase, CheckCircle2, AlertCircle, Loader2,
  Share2, Award, Zap, Sparkles, Newspaper, QrCode
} from 'lucide-react';

const PROJECT_TYPES = [
  { id: 'seo', label: 'SEO Audit', icon: Search, color: 'text-blue-500' },
  { id: 'social', label: 'SMM Campaign', icon: Megaphone, color: 'text-purple-500' },
  { id: 'ads', label: 'PPC / Meta Ads', icon: MousePointer2, color: 'text-emerald-500' },
  { id: 'design', label: 'Web Design', icon: Layout, color: 'text-orange-500' }
];

export default function PortfolioPage() {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', type: 'seo', description: '' });

  const fetchProjects = async () => {
    if (!userProfile?.uid) return;
    try {
      const q = query(collection(db, 'portfolios'), where('uid', '==', userProfile.uid));
      const snap = await getDocs(q);
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, [userProfile]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addDoc(collection(db, 'portfolios'), {
        ...form,
        uid: userProfile.uid,
        studentName: userProfile.name,
        createdAt: serverTimestamp()
      });
      setShowAdd(false);
      setForm({ title: '', url: '', type: 'seo', description: '' });
      fetchProjects();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await deleteDoc(doc(db, 'portfolios', id));
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between px-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Campaign Portfolio</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Showcase your marketing projects and results</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="h-12 w-12 bg-[#255A84] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#255A84]/20 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></div>
      ) : projects.length === 0 && !showAdd ? (
        <div className="mx-2 bg-white rounded-[2.5rem] p-12 text-center border border-dashed border-slate-200">
          <div className="h-20 w-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
            <Briefcase size={40} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Projects Yet</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-[240px] mx-auto">Start building your portfolio by adding your campaign links.</p>
          <button 
            onClick={() => setShowAdd(true)}
            className="mt-8 px-8 py-3.5 bg-[#255A84] text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#255A84]/20"
          >
            Add Your First Work
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
          {projects.map(p => {
            const typeInfo = PROJECT_TYPES.find(t => t.id === p.type) || PROJECT_TYPES[0];
            return (
              <div key={p.id} className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 group">
                <div className="flex items-start justify-between">
                  <div className={`h-10 w-10 rounded-xl ${typeInfo.color} bg-opacity-10 flex items-center justify-center`}>
                    <typeInfo.icon size={20} />
                  </div>
                  <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-4">
                  <h3 className="font-bold text-slate-800 text-base">{p.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">{typeInfo.label}</p>
                  {p.description && <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">{p.description}</p>}
                </div>
                <a 
                  href={p.url} target="_blank" rel="noopener noreferrer"
                  className="mt-6 flex items-center justify-between p-3 bg-slate-50 rounded-xl group/link"
                >
                  <div className="flex items-center gap-2 text-slate-400 min-w-0">
                    <Globe size={14} />
                    <span className="text-[10px] font-bold truncate uppercase tracking-wider">
                      {(() => {
                        try { return new URL(p.url).hostname; }
                        catch { return 'View Project'; }
                      })()}
                    </span>
                  </div>
                  <ExternalLink size={14} className="text-slate-300 group-hover/link:text-[#255A84] transition-colors" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Project Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-lg shadow-2xl p-8 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Add Campaign Link</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-300 hover:text-slate-600 transition-colors"><XCircle size={28} /></button>
            </div>

            <form onSubmit={handleAdd} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Project Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {PROJECT_TYPES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm({ ...form, type: t.id })}
                      className={`flex items-center gap-2 p-3 rounded-2xl border transition-all ${form.type === t.id ? 'bg-[#255A84] text-white border-transparent shadow-lg' : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'}`}
                    >
                      <t.icon size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Project Title</label>
                <input 
                  required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. My Website SEO Audit"
                  className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Live URL (Drive/Website)</label>
                <input 
                  required type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
                  placeholder="https://docs.google.com/..."
                  className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Brief Description (Optional)</label>
                <textarea 
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows="3" placeholder="Key highlights of your campaign..."
                  className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84] transition-all resize-none"
                />
              </div>

              <button 
                type="submit" disabled={saving}
                className="w-full py-5 bg-[#255A84] text-white rounded-[2rem] font-bold text-sm uppercase tracking-widest shadow-xl shadow-[#255A84]/20 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Share2 size={20} />}
                {saving ? 'Publishing...' : 'Publish to Portfolio'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function XCircle({ size, className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" width={size} height={size} 
      viewBox="0 0 24 24" fill="none" stroke="currentColor" 
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
    </svg>
  );
}
