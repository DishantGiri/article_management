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
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSession } from "next-auth/react";
import SiteLogo from "@/components/SiteLogo";

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
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN";

  const [sites, setSites] = useState<SiteData[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState("");

  const openConfirm = (message: string, action: () => void) => {
    setConfirmMsg(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

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
    setForm({ name: "", url: "", categoryIds: [] });
    setError("");
    setUrlError("");
    setShowModal(true);
  };

  const openEditModal = (s: SiteData) => {
    setEditingSiteId(s.id);
    setForm({
      name: s.name,
      url: s.url || "",
      categoryIds: s.categories?.map((c) => c.id) || [],
    });
    setError("");
    setUrlError("");
    setShowModal(true);
    setActiveDropdown(null);
  };

  const handleDelete = async (id: number) => {
    setActiveDropdown(null);
    openConfirm(
      "Are you sure you want to delete this site? All associated products and data will be lost.",
      async () => {
        try {
          const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to delete site");

          toast.success("Site deleted successfully!");
          fetchSites(false);
        } catch (e: any) {
          toast.error(e.message || "Failed to delete site");
        }
      }
    );
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A] tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#6D8196]" />
            Sites
          </h1>
          <p className="text-[#737373] text-sm mt-0.5 font-medium">Manage websites, default sub IDs, bridge & buy now URLs</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-[#6D8196] text-white rounded-xl text-xs font-bold hover:bg-[#5A6D81] active:scale-[0.98] shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Site
          </button>
        )}
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#CBCBCB] border-t-[#6D8196] rounded-full animate-spin" />
        </div>
      ) : !Array.isArray(sites) || sites.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 p-16 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#6D8196]/15 text-[#3D4F61] flex items-center justify-center mx-auto mb-3">
            <Globe className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#4A4A4A]">No Sites Configured</h3>
          <p className="text-xs text-[#737373] font-medium mt-1">Get started by creating your first website configuration.</p>
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="mt-4 px-4 py-2 bg-[#6D8196] text-white rounded-xl text-xs font-bold hover:bg-[#5A6D81] transition cursor-pointer"
            >
              Add First Site
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {(Array.isArray(sites) ? sites : []).map((site) => (
            <div
              key={site.id}
              className="bg-white border border-[#CBCBCB]/60 hover:border-[#6D8196] rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all group relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <SiteLogo url={site.url} name={site.name} className="w-10 h-10" />
                    <div>
                      <h3 className="text-sm font-bold text-[#4A4A4A] leading-tight">{site.name}</h3>
                      {site.url && (
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#6D8196] hover:text-[#4A4A4A] hover:underline font-semibold flex items-center gap-1 mt-0.5"
                        >
                          <span className="truncate max-w-[150px]">{site.url.replace(/^https?:\/\//, "")}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Dropdown Container */}
                  {isAdmin && (
                    <div className="relative">
                      <button
                        onClick={() => setActiveDropdown(activeDropdown === site.id ? null : site.id)}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-[#4A4A4A] hover:bg-[#FAF9F5] flex items-center justify-center transition focus:outline-none cursor-pointer"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {activeDropdown === site.id && (
                        <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-[#CBCBCB]/60 py-1 z-10 animate-fadeIn">
                          <button
                            onClick={() => openEditModal(site)}
                            className="w-full text-left px-3.5 py-2 text-xs font-bold text-[#4A4A4A] hover:bg-[#FAF9F5] flex items-center gap-2 cursor-pointer"
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
                  )}
                </div>

                {/* Product Type Pills */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {site.categories && site.categories.length > 0 ? (
                    site.categories.map((c) => (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF9F5] text-[#4A4A4A] border border-[#CBCBCB]"
                      >
                        {c.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] font-medium text-[#737373] italic">No product types assigned</span>
                  )}
                </div>
              </div>

              {/* Stats Footer */}
              <div className="grid grid-cols-3 gap-2 border-t border-[#CBCBCB]/40 pt-3 mt-auto">
                <div className="text-center">
                  <p className="text-lg font-bold text-[#4A4A4A]">{site.productsCount ?? 0}</p>
                  <p className="text-[9px] font-bold text-[#737373] uppercase tracking-wider">Products</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-[#4A4A4A]">{site.categoriesCount ?? 0}</p>
                  <p className="text-[9px] font-bold text-[#737373] uppercase tracking-wider">Product Types</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-[#4A4A4A]">{site.linksCount ?? 0}</p>
                  <p className="text-[9px] font-bold text-[#737373] uppercase tracking-wider">Links</p>
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
            <div className="px-6 py-4 bg-[#4A4A4A] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <SiteLogo url={form.url} name={form.name || "Site"} className="w-10 h-10" />
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {editingSiteId ? "Edit Site Configuration" : "Add New Site"}
                  </h2>
                  <p className="text-xs text-[#EAEAEA] font-medium">Configure domain URLs and link auto-generation defaults</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
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
                  <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#6D8196]" />
                    Site Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#CBCBCB] rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] shadow-2xs transition-all"
                    placeholder="e.g. Health Daily"
                  />
                </div>

                {/* Website Main URL */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#6D8196]" />
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
                        : "border-[#CBCBCB] focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
                    }`}
                    placeholder="https://example.com"
                  />
                  {urlError && <p className="text-xs font-semibold text-rose-500">{urlError}</p>}
                </div>
              </div>

              {/* Product Types Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#6D8196]" />
                  Product Types
                </label>
                {allCategories.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No product types exist. Create some in the Product Types page first.</p>
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
            <div className="px-6 py-4 bg-[#FAF9F5] border-t border-[#CBCBCB]/40 flex items-center justify-between shrink-0">
              <div className="text-xs font-semibold text-slate-500">
                {form.categoryIds.length} {form.categoryIds.length === 1 ? "product type" : "product types"} selected
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBCBCB] text-[#4A4A4A] font-bold hover:bg-white transition text-xs shadow-2xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSite}
                  disabled={saving || !form.name.trim()}
                  className="px-5 py-2.5 bg-[#6D8196] hover:bg-[#5A6D81] active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                >
                  {saving ? "Saving..." : editingSiteId ? "Save Changes" : "Add Site"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Site"
        message={confirmMsg}
        confirmLabel="Delete Site"
        variant="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          confirmAction?.();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
