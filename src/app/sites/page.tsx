"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  X,
  Building2,
  Link2,
  ShoppingBag,
  Tag,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "react-hot-toast";

interface Category {
  id: number;
  name: string;
}

interface SiteData {
  id: number;
  name: string;
  url: string | null;
  subId: string | null;
  bridgeUrl: string | null;
  buyUrl: string | null;
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
    subId: "",
    bridgeUrl: "",
    buyUrl: "",
    categoryIds: [] as number[],
  });
  const [urlError, setUrlError] = useState("");

  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  const fetchSites = (showLoading = true) => {
    if (showLoading) setLoading(true);
    fetch("/api/sites")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSites(data);
        } else {
          setSites([]);
          if (data && data.error) toast.error(data.error);
        }
      })
      .catch((err) => {
        setSites([]);
        console.error("Failed to load sites", err);
      })
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  };

  const fetchCategories = () => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setAllCategories(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    fetchSites(true);
    fetchCategories();
  }, []);

  const openAddModal = () => {
    setEditingSiteId(null);
    setForm({ name: "", url: "", subId: "", bridgeUrl: "", buyUrl: "", categoryIds: [] });
    setError("");
    setUrlError("");
    setShowModal(true);
  };

  const openEditModal = (s: SiteData) => {
    setEditingSiteId(s.id);
    setForm({
      name: s.name,
      url: s.url || "",
      subId: s.subId || "",
      bridgeUrl: s.bridgeUrl || "",
      buyUrl: s.buyUrl || "",
      categoryIds: s.categories?.map((c) => c.id) || [],
    });
    setError("");
    setUrlError("");
    setShowModal(true);
    setActiveDropdown(null);
  };

  const handleDelete = async (id: number) => {
    setActiveDropdown(null);
    if (!confirm("Are you sure you want to delete this site? All associated products and data will be lost.")) return;

    try {
      const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete site");

      setSites((prev) => prev.filter((s) => s.id !== id));
      toast.success("Site deleted successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete site");
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
    if (urlError) {
      setError("Please fix the URL validation error before saving.");
      return;
    }
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

      fetchSites(false);
      toast.success(editingSiteId ? "Site updated successfully!" : "Site created successfully!");
      setShowModal(false);
    } catch (e: any) {
      setError(e.message || "Failed to save site");
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (catId: number) => {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(catId)
        ? prev.categoryIds.filter((id) => id !== catId)
        : [...prev.categoryIds, catId],
    }));
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            Sites
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">Manage websites, default sub IDs, bridge & buy now URLs</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 active:scale-[0.98] shadow-md shadow-indigo-100 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Site
        </button>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : !Array.isArray(sites) || sites.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <Globe className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Sites Configured</h3>
          <p className="text-xs text-slate-500 font-medium mt-1">Get started by creating your first website configuration.</p>
          <button
            onClick={openAddModal}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
          >
            Add First Site
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {(Array.isArray(sites) ? sites : []).map((site) => (
            <div
              key={site.id}
              className="bg-white border border-slate-200/80 hover:border-indigo-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all group relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">{site.name}</h3>
                      {site.url && (
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-600 hover:underline font-semibold flex items-center gap-1 mt-0.5"
                        >
                          <span className="truncate max-w-[150px]">{site.url.replace(/^https?:\/\//, "")}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Dropdown Container */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === site.id ? null : site.id)}
                      className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition focus:outline-none cursor-pointer"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {activeDropdown === site.id && (
                      <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-10 animate-fadeIn">
                        <button
                          onClick={() => openEditModal(site)}
                          className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          Edit Site
                        </button>
                        <button
                          onClick={() => handleDelete(site.id)}
                          className="w-full text-left px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          Delete Site
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Site Metadata Badges */}
                <div className="mb-4 space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  {site.subId && (
                    <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                      <span className="font-bold text-slate-400 uppercase text-[9px]">Sub ID:</span>
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-100/60 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">
                        {site.subId}
                      </span>
                    </div>
                  )}
                  {site.bridgeUrl && (
                    <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-400 uppercase text-[9px] shrink-0">Bridge Base:</span>
                      <span className="text-indigo-600 text-[11px] truncate font-medium">{site.bridgeUrl}</span>
                    </div>
                  )}
                  {site.buyUrl && (
                    <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-400 uppercase text-[9px] shrink-0">Buy Now Base:</span>
                      <span className="text-emerald-600 text-[11px] truncate font-medium">{site.buyUrl}</span>
                    </div>
                  )}
                </div>

                {/* Category Pills */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {site.categories && site.categories.length > 0 ? (
                    site.categories.map((c) => (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/50"
                      >
                        {c.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400 italic">No categories assigned</span>
                  )}
                </div>
              </div>

              {/* Stats Footer */}
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 mt-auto">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">{site.productsCount ?? 0}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Products</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">{site.categoriesCount ?? 0}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Categories</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">{site.linksCount ?? 0}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Links</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Site Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {editingSiteId ? "Edit Site Configuration" : "Add New Site"}
                  </h2>
                  <p className="text-xs text-slate-300 font-medium">Configure domain URLs and link auto-generation defaults</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 2-Column Inputs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Site Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    Site Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all"
                    placeholder="e.g. Health Daily"
                  />
                </div>

                {/* Website Main URL */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={form.url}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm({ ...form, url: val });
                      if (val && !isValidUrl(val)) {
                        setUrlError("Must start with http:// or https:// and be a valid URL");
                      } else {
                        setUrlError("");
                      }
                    }}
                    className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none transition-all shadow-2xs ${
                      urlError
                        ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/10"
                        : "border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    }`}
                    placeholder="https://example.com"
                  />
                  {urlError && <p className="text-xs font-semibold text-rose-500">{urlError}</p>}
                </div>
              </div>

              {/* Sub ID Section */}
              <div className="space-y-1.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  Default Sub ID
                </label>
                <input
                  type="text"
                  value={form.subId}
                  onChange={(e) => setForm({ ...form, subId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  placeholder="e.g. site_sub_01"
                />
                <p className="text-[11px] text-slate-500 font-medium">Used to auto-fill Sub ID for links created under this site.</p>
              </div>

              {/* Bridge Page Base URL */}
              <div className="space-y-1.5 bg-indigo-50/30 p-3.5 rounded-xl border border-indigo-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                  Bridge Page Base URL
                </label>
                <input
                  type="url"
                  value={form.bridgeUrl}
                  onChange={(e) => setForm({ ...form, bridgeUrl: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  placeholder="e.g. https://mybridge.com/pages"
                />
                <div className="flex items-center gap-1 text-[11px] text-indigo-600 font-semibold mt-1">
                  <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span>Auto-generated format: bridgeBaseUrl / product-slug</span>
                </div>
              </div>

              {/* Buy Now Base URL */}
              <div className="space-y-1.5 bg-emerald-50/30 p-3.5 rounded-xl border border-emerald-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                  Buy Now Base URL
                </label>
                <input
                  type="url"
                  value={form.buyUrl}
                  onChange={(e) => setForm({ ...form, buyUrl: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
                  placeholder="e.g. https://buy.tbrskincare.com"
                />
                <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold mt-1">
                  <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span>Auto-generated format: buyNowBaseUrl / product-slug</span>
                </div>
              </div>

              {/* Categories Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Categories
                </label>
                {allCategories.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No categories exist. Create some in the Categories page first.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto p-1 pr-2">
                    {allCategories.map((cat) => (
                      <Toggle
                        key={cat.id}
                        checked={form.categoryIds.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                        label={cat.name}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div className="text-xs font-semibold text-slate-500">
                {form.categoryIds.length} {form.categoryIds.length === 1 ? "category" : "categories"} selected
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-white transition text-xs shadow-2xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSite}
                  disabled={saving || !form.name.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {saving ? "Saving..." : editingSiteId ? "Save Changes" : "Add Site"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
