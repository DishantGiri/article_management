"use client";

import { useEffect, useState } from "react";
import { Globe, MoreHorizontal, Plus, Pencil, Trash2, X } from "lucide-react";

interface Category {
  id: number;
  name: string;
}

interface SiteData {
  id: number;
  name: string;
  url: string | null;
  productsCount: number;
  categoriesCount: number;
  linksCount: number;
  categories: Category[];
}

export default function SitesPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [form, setForm] = useState({
    name: "",
    url: "",
    categoryIds: [] as number[],
  });

  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  const fetchSites = () => {
    setLoading(true);
    fetch("/api/sites")
      .then((r) => r.json())
      .then((data) => setSites(data))
      .finally(() => setLoading(false));
  };

  const fetchCategories = () => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setAllCategories(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    fetchSites();
    fetchCategories();
  }, []);

  const openAddModal = () => {
    setEditingSiteId(null);
    setForm({ name: "", url: "", categoryIds: [] });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (s: SiteData) => {
    setEditingSiteId(s.id);
    setForm({ 
      name: s.name, 
      url: s.url || "",
      categoryIds: s.categories?.map(c => c.id) || []
    });
    setError("");
    setShowModal(true);
    setActiveDropdown(null);
  };

  const handleDelete = async (id: number) => {
    setActiveDropdown(null);
    if (!confirm("Are you sure you want to delete this site? All associated products and data will be lost.")) return;
    
    try {
      const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSites(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      alert(e.message || "Failed to delete site");
    }
  };

const isValidUrl = (url: string) => {
  if (!url) return true;
  try {
    if (!/^https?:\/\//i.test(url)) return false;
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

  const handleSaveSite = async () => {
    if (form.url && !isValidUrl(form.url)) {
      setError("Please enter a valid URL (must start with http:// or https://)");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const url = editingSiteId ? `/api/sites/${editingSiteId}` : "/api/sites";
      const method = editingSiteId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      fetchSites();
      setSuccess(editingSiteId ? "Site updated successfully!" : "Site created successfully!");
      setShowModal(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to save site");
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (catId: number) => {
    setForm(prev => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(catId)
        ? prev.categoryIds.filter(id => id !== catId)
        : [...prev.categoryIds, catId]
    }));
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sites</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">{sites.length} sites configured</p>
        </div>
        <button onClick={openAddModal} className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-600 shadow-sm transition flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Site
        </button>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : sites.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <p className="text-slate-500 font-medium">No sites configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sites.map((site) => (
            <div key={site.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group relative flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 leading-tight">{site.name}</h3>
                    </div>
                  </div>
                  
                  {/* Dropdown Container */}
                  <div className="relative">
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === site.id ? null : site.id)}
                      className="text-slate-300 hover:text-slate-500 transition focus:outline-none"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {activeDropdown === site.id && (
                      <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-10">
                        <button 
                          onClick={() => openEditModal(site)}
                          className="w-full text-left px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          Edit Site
                        </button>
                        <button 
                          onClick={() => handleDelete(site.id)}
                          className="w-full text-left px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          Delete Site
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {site.categories?.map(c => (
                    <span key={c.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">
                      {c.name}
                    </span>
                  ))}
                  {(!site.categories || site.categories.length === 0) && (
                    <span className="text-[10px] font-medium text-slate-400 italic">No categories</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 mt-auto">
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-800">{site.productsCount ?? 0}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Products</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-800">{site.categoriesCount ?? 0}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Categories</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-800">{site.linksCount ?? 0}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Links</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Site Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-800">{editingSiteId ? "Edit Site" : "Add New Site"}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto">
              {error && <div className="p-3 bg-rose-50 text-rose-600 text-sm font-medium rounded-lg">{error}</div>}
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Site Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Health Daily"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">URL</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Categories</label>
                {allCategories.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No categories exist. Create some in the Categories page first.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-2">
                    {allCategories.map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={form.categoryIds.includes(cat.id)}
                          onChange={() => toggleCategory(cat.id)}
                          className="w-4 h-4 text-indigo-500 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSite}
                disabled={saving || !form.name}
                className="px-5 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-600 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : (editingSiteId ? "Save Changes" : "Add Site")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
