import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Zap, Plus, Trash2, Edit2, ExternalLink, 
  Search, Globe, MousePointer2, Megaphone, BarChart3, 
  Mail, Sparkles, Loader2, Save, X
} from 'lucide-react';

const CATEGORIES = [
  { id: 'seo', label: 'SEO & Search', icon: Search },
  { id: 'social', label: 'Social Media', icon: Megaphone },
  { id: 'ads', label: 'Paid Ads (PPC)', icon: MousePointer2 },
  { id: 'content', label: 'Content & Design', icon: Globe },
  { id: 'analytics', label: 'Analytics & Data', icon: BarChart3 },
  { id: 'email', label: 'Email & CRM', icon: Mail }
];

export default function AdminToolsPage() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', url: '', categoryId: 'seo', description: '' });

  const fetchTools = async () => {
    try {
      const snap = await getDocs(collection(db, 'marketing_tools'));
      setTools(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTools(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'marketing_tools', editingId), { ...form, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'marketing_tools'), { ...form, createdAt: serverTimestamp() });
      }
      setShowAdd(false);
      setEditingId(null);
      setForm({ name: '', url: '', categoryId: 'seo', description: '' });
      fetchTools();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this tool?')) return;
    try {
      await deleteDoc(doc(db, 'marketing_tools', id));
      setTools(tools.filter(t => t.id !== id));
    } catch (err) { console.error(err); }
  };

  const startEdit = (tool) => {
    setForm({ name: tool.name, url: tool.url, categoryId: tool.categoryId, description: tool.description });
    setEditingId(tool.id);
    setShowAdd(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tools Manager</h1>
          <p className="text-sm text-slate-500 font-medium">Manage the digital marketing tools repository</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setForm({ name: '', url: '', categoryId: 'seo', description: '' }); setShowAdd(true); }}
          className="px-6 py-3 bg-[#255A84] text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#255A84]/20 flex items-center gap-2 hover:scale-105 transition-all"
        >
          <Plus size={18} /> Add New Tool
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#255A84]" size={32} /></div>
      ) : tools.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-12 text-center border border-dashed border-slate-200">
          <Zap size={48} className="mx-auto mb-4 text-slate-200" />
          <h3 className="font-bold text-slate-800">No tools found</h3>
          <p className="text-sm text-slate-400 mt-2">Start by adding tools that students should use.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map(tool => {
            const cat = CATEGORIES.find(c => c.id === tool.categoryId) || CATEGORIES[0];
            return (
              <div key={tool.id} className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 flex flex-col group">
                <div className="flex items-center justify-between mb-4">
                  <div className={`h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#255A84]`}>
                    <cat.icon size={20} />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(tool)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(tool.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={14} /></button>
                  </div>
                </div>
                <h3 className="font-bold text-slate-800">{tool.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{cat.label}</p>
                <p className="text-xs text-slate-500 mt-3 flex-1 line-clamp-2">{tool.description}</p>
                <a href={tool.url} target="_blank" rel="noopener noreferrer" className="mt-5 flex items-center justify-between p-3 bg-slate-50 rounded-xl group/link">
                  <span className="text-[10px] font-bold text-slate-400 truncate max-w-[150px]">{new URL(tool.url).hostname}</span>
                  <ExternalLink size={14} className="text-slate-300 group-hover/link:text-[#255A84] transition-colors" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-lg shadow-2xl p-8 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{editingId ? 'Edit Tool' : 'Add New Tool'}</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-300 hover:text-slate-600 transition-colors"><X size={28} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Tool Name</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Google Analytics 4" className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84] transition-all" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Website URL</label>
                <input required type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84] transition-all" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.id} type="button" onClick={() => setForm({ ...form, categoryId: c.id })}
                      className={`flex items-center gap-2 p-3 rounded-2xl border transition-all ${form.categoryId === c.id ? 'bg-[#255A84] text-white border-transparent shadow-lg' : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'}`}
                    >
                      <c.icon size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Short Description</label>
                <textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows="3" placeholder="What is this tool used for?" className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#255A84] transition-all resize-none" />
              </div>

              <button disabled={saving} type="submit" className="w-full py-5 bg-[#255A84] text-white rounded-[2rem] font-bold text-sm uppercase tracking-widest shadow-xl shadow-[#255A84]/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {saving ? 'Saving...' : (editingId ? 'Update Tool' : 'Add Tool')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
