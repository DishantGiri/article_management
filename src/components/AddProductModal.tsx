"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import CustomSelect from "@/components/CustomSelect";
import {
  Package,
  X,
  Globe,
  Tag,
  TrendingUp,
  Link2,
  Layers,
  Plus,
  AlertCircle,
  Sparkles,
  Check,
  ChevronDown,
} from "lucide-react";

interface Site {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

interface Affiliate {
  id: number;
  name: string;
}

interface FormData {
  categoryIds: number[];
  name: string;
  category: string;
  trendLink: string;
  trendLevel: string;
  affiliateName: string;
  previewLink: string;
  remarks: string;
}

function StepIndicator({ step }: { step: number }) {
  const steps = ["Product Type", "Preview Sites", "Details"];
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = step === idx;
        const done = step > idx;
        return (
          <div key={idx} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done
                    ? "bg-[#6D8196] text-white"
                    : active
                    ? "bg-[#6D8196] text-white ring-4 ring-[#6D8196]/20 shadow-xs"
                    : "bg-slate-100 text-slate-400 border border-slate-200"
                }`}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx
                )}
              </div>
              <span
                className={`text-[10px] font-bold tracking-tight whitespace-nowrap ${
                  active ? "text-[#6D8196]" : done ? "text-[#4A4A4A]" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mb-4 rounded transition-all duration-500 ${
                  done ? "bg-emerald-400" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AddProductModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN";
  const [step, setStep] = useState(1);
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successState, setSuccessState] = useState(false);

  const [customAffiliate, setCustomAffiliate] = useState("");
  const [showCustomAffiliate, setShowCustomAffiliate] = useState(false);

  const [form, setForm] = useState<FormData>({
    categoryIds: [],
    name: "",
    category: "",
    trendLink: "",
    trendLevel: "HIGH",
    affiliateName: "",
    previewLink: "",
    remarks: "",
  });

  // Deselected/excluded sites state
  const [excludedSiteIds, setExcludedSiteIds] = useState<number[]>([]);

  // Inline creation states
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  const [showAddSite, setShowAddSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteUrl, setNewSiteUrl] = useState("");
  const [addingSite, setAddingSite] = useState(false);

  const handleInlineAddCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setAddingCat(true);
    setError("");
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create category");
      setCategories((prev) => [...prev, data]);
      setForm((prev) => ({ ...prev, categoryIds: [...prev.categoryIds, data.id] }));
      setNewCatName("");
      setShowAddCat(false);
    } catch (err: any) {
      setError(err.message || "Failed to add category");
    } finally {
      setAddingCat(false);
    }
  };

  const handleInlineAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;
    setAddingSite(true);
    setError("");
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSiteName.trim(),
          url: newSiteUrl.trim() || null,
          categoryIds: form.categoryIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create site");
      const sitesRes = await fetch("/api/sites");
      const sitesData = await sitesRes.json();
      setSites(Array.isArray(sitesData) ? sitesData : []);
      setNewSiteName("");
      setNewSiteUrl("");
      setShowAddSite(false);
    } catch (err: any) {
      setError(err.message || "Failed to add site");
    } finally {
      setAddingSite(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSuccessState(false);
      setShowAddCat(false);
      setShowAddSite(false);
      setShowCustomAffiliate(false);
      setCustomAffiliate("");
      setExcludedSiteIds([]);
      setForm({
        categoryIds: [],
        name: "",
        category: "",
        trendLink: "",
        trendLevel: "HIGH",
        affiliateName: "",
        previewLink: "",
        remarks: "",
      });
      setLoading(true);
      Promise.all([
        fetch("/api/categories").then((r) => r.json()),
        fetch("/api/sites").then((r) => r.json()),
        fetch("/api/affiliates").then((r) => r.json()),
      ])
        .then(([catsData, sitesData, affsData]) => {
          setCategories(Array.isArray(catsData) ? catsData : []);
          setSites(Array.isArray(sitesData) ? sitesData : []);
          setAffiliates(Array.isArray(affsData) ? affsData : []);
        })
        .catch(() => setError("Failed to load initial data"))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const update = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");

    if (field === "trendLink" || field === "previewLink") {
      if (value && !isValidUrl(value)) {
        setFieldErrors((prevErrors) => ({
          ...prevErrors,
          [field]: "Must start with http:// or https:// and be a valid URL",
        }));
      } else {
        setFieldErrors((prevErrors) => {
          const next = { ...prevErrors };
          delete next[field];
          return next;
        });
      }
    }
  }, []);

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

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }
    if (Object.keys(fieldErrors).length > 0) {
      setError("Please fix the link validation errors before submitting.");
      return;
    }
    if (form.trendLink && !isValidUrl(form.trendLink)) {
      setError("Please enter a valid Trend Link URL (must start with http:// or https://)");
      return;
    }
    if (form.previewLink && !isValidUrl(form.previewLink)) {
      setError("Please enter a valid Preview Link URL (must start with http:// or https://)");
      return;
    }
    setSubmitting(true);
    setError("");

    const finalAffiliate = showCustomAffiliate ? customAffiliate.trim() : form.affiliateName;

    try {
      if (showCustomAffiliate && customAffiliate.trim()) {
        fetch("/api/affiliates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: customAffiliate.trim() }),
        }).catch(() => {});
      }

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          categoryIds: form.categoryIds,
          excludedSiteIds,
          productCategory: form.category.trim() || null,
          trendLink: form.trendLink || null,
          trendLevel: form.trendLevel || "HIGH",
          affiliateName: finalAffiliate || null,
          previewLink: form.previewLink || null,
          remarks: form.remarks || null,
          addedById: session?.user?.id || 1,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create product");
      }

      setSuccessState(true);
      if (onSuccess) onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryNames = () => {
    return categories
      .filter((c) => form.categoryIds.includes(c.id))
      .map((c) => c.name)
      .join(", ");
  };

  const previewSites = sites.filter((site: any) =>
    site.categories?.some((c: any) => form.categoryIds.includes(c.id))
  );

  const activeSites = previewSites.filter((site: any) => !excludedSiteIds.includes(site.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#4A4A4A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6D8196]/30 border border-[#6D8196]/40 flex items-center justify-center text-white shadow-inner">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Add New Product</h2>
              <p className="text-xs text-[#EAEAEA] font-medium">Select product type, websites, trend rating & affiliate info</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-[#EAEAEA] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {successState ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Product Added Successfully!</h3>
              <p className="text-xs text-slate-500 font-medium mb-6">
                <strong className="text-slate-800">{form.name}</strong> has been added to {getCategoryNames()}.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setForm({
                      categoryIds: [],
                      name: "",
                      category: "",
                      trendLink: "",
                      trendLevel: "HIGH",
                      affiliateName: "",
                      previewLink: "",
                      remarks: "",
                    });
                    setStep(1);
                    setSuccessState(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Add Another
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <StepIndicator step={step} />

              {error && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      Select Product Type <span className="text-rose-500">*</span>
                    </label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowAddCat(!showAddCat)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {showAddCat ? "Cancel" : "Add Product Type"}
                      </button>
                    )}
                  </div>

                  {showAddCat && (
                    <form onSubmit={handleInlineAddCat} className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Product type name (e.g. Skin Care, Ecomm, Supplements)"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={addingCat || !newCatName.trim()}
                        className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
                      >
                        {addingCat ? "Saving..." : "Create & Select"}
                      </button>
                    </form>
                  )}

                  {loading ? (
                    <div className="text-center py-8 text-xs text-slate-500 font-semibold">Loading product types...</div>
                  ) : categories.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 italic">No product types found. Click "+ Add Product Type" above.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 pr-2">
                      {categories.map((c) => {
                        const selected = form.categoryIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                categoryIds: selected
                                  ? prev.categoryIds.filter((id) => id !== c.id)
                                  : [...prev.categoryIds, c.id],
                              }));
                            }}
                            className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              selected
                                ? "bg-[#6D8196]/15 border-[#6D8196]/40 text-[#3D4F61] font-bold shadow-2xs"
                                : "bg-white border-slate-200 text-slate-700 font-semibold hover:border-slate-300"
                            }`}
                          >
                            <span className="text-xs truncate">{c.name}</span>
                            <div
                              className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${
                                selected ? "bg-[#6D8196] border-[#6D8196] text-white" : "border-slate-300 bg-white"
                              }`}
                            >
                              {selected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      disabled={form.categoryIds.length === 0}
                      onClick={() => setStep(2)}
                      className="w-full py-2.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white font-bold text-xs disabled:opacity-50 transition cursor-pointer shadow-xs"
                    >
                      Continue ({form.categoryIds.length} selected)
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-600" />
                      Associated Websites
                    </label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowAddSite(!showAddSite)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {showAddSite ? "Cancel" : "Add Website"}
                      </button>
                    )}
                  </div>

                  {showAddSite && (
                    <form onSubmit={handleInlineAddSite} className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2">
                      <input
                        type="text"
                        value={newSiteName}
                        onChange={(e) => setNewSiteName(e.target.value)}
                        placeholder="Site Name (e.g. Health Daily)"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="url"
                        value={newSiteUrl}
                        onChange={(e) => setNewSiteUrl(e.target.value)}
                        placeholder="Site URL (https://...)"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={addingSite || !newSiteName.trim()}
                        className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
                      >
                        {addingSite ? "Saving..." : "Create & Link"}
                      </button>
                    </form>
                  )}

                  {previewSites.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 italic">
                      No websites found for selected categories. Click "+ Add Website" above to configure one.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto p-1 pr-2">
                      {previewSites.map((site: any) => {
                        const isExcluded = excludedSiteIds.includes(site.id);
                        return (
                          <div
                            key={site.id}
                            className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all ${
                              isExcluded
                                ? "bg-slate-50/50 border-slate-200 text-slate-400 opacity-60"
                                : "bg-slate-50 border-slate-200/80 text-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`font-bold text-xs truncate ${isExcluded ? "line-through text-slate-400" : "text-slate-800"}`}>
                                {site.name}
                              </span>
                              {isExcluded ? (
                                <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-md font-bold border border-rose-100 shrink-0">
                                  Excluded
                                </span>
                              ) : (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold border border-indigo-100 shrink-0">
                                  Auto-assigned
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setExcludedSiteIds((prev) =>
                                  isExcluded ? prev.filter((id) => id !== site.id) : [...prev, site.id]
                                );
                              }}
                              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0 ${
                                isExcluded
                                  ? "text-indigo-600 hover:bg-indigo-50"
                                  : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              }`}
                              title={isExcluded ? "Re-include this site" : "Remove/Deselect this site"}
                            >
                              {isExcluded ? (
                                <span className="text-[11px] font-bold text-indigo-600">Re-include</span>
                              ) : (
                                <>
                                  <X className="w-4 h-4 text-slate-400 hover:text-rose-600" />
                                  <span className="text-[11px] font-bold text-slate-500 hover:text-rose-600">Remove</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition text-xs cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      disabled={activeSites.length === 0}
                      onClick={() => setStep(3)}
                      className="flex-1 py-2.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white font-bold text-xs disabled:opacity-50 transition cursor-pointer shadow-xs"
                    >
                      Continue ({activeSites.length} site{activeSites.length !== 1 ? "s" : ""})
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Grid 2-Column: Product Name & Affiliate Dropdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Product Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-indigo-600" />
                        Product Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="e.g. Alpha Whey"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                      />
                    </div>

                    {/* Affiliate Network Dropdown */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        Affiliate Network / Name
                      </label>
                      {!showCustomAffiliate ? (
                        <CustomSelect
                          value={form.affiliateName}
                          onChange={(val) => {
                            if (val === "__NEW__") {
                              setShowCustomAffiliate(true);
                              setForm((prev) => ({ ...prev, affiliateName: "" }));
                            } else {
                              setForm((prev) => ({ ...prev, affiliateName: val }));
                            }
                          }}
                          placeholder="Select Affiliate..."
                          options={[
                            ...affiliates.map((aff) => ({ value: aff.name, label: aff.name })),
                            { value: "__NEW__", label: "+ Add Custom Affiliate...", isAction: true }
                          ]}
                        />
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customAffiliate}
                            onChange={(e) => setCustomAffiliate(e.target.value)}
                            placeholder="Enter affiliate name..."
                            className="flex-1 px-3.5 py-2.5 bg-white border border-indigo-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCustomAffiliate(false)}
                            className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grid 2-Column: Trend Level & Trend Link */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Trend Rating Dropdown */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                        Trend Level
                      </label>
                      <CustomSelect
                        value={form.trendLevel}
                        onChange={(val) => update("trendLevel", val)}
                        placeholder="Select Trend Level..."
                        options={[
                          { value: "HIGH", label: "🔥 High Trend" },
                          { value: "MODERATE", label: "📈 Moderate Trend" },
                          { value: "LOW", label: "📉 Low / Stable" },
                        ]}
                      />
                    </div>

                    {/* Trend Link */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                        Trend Link URL
                      </label>
                      <input
                        type="url"
                        value={form.trendLink}
                        onChange={(e) => update("trendLink", e.target.value)}
                        placeholder="https://..."
                        className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none transition-all shadow-2xs ${
                          fieldErrors.trendLink
                            ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/10"
                            : "border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        }`}
                      />
                      {fieldErrors.trendLink && (
                        <p className="text-xs font-semibold text-rose-500">{fieldErrors.trendLink}</p>
                      )}
                    </div>
                  </div>

                  {/* Grid 2-Column: Preview Link & Category */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Preview Link */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-[#6D8196]" />
                        Preview Link URL
                      </label>
                      <input
                        type="url"
                        value={form.previewLink}
                        onChange={(e) => update("previewLink", e.target.value)}
                        placeholder="https://..."
                        className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none transition-all shadow-2xs ${
                          fieldErrors.previewLink
                            ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/10"
                            : "border-slate-200 focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
                        }`}
                      />
                      {fieldErrors.previewLink && (
                        <p className="text-xs font-semibold text-rose-500">{fieldErrors.previewLink}</p>
                      )}
                    </div>

                    {/* New Defined Category Field */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#6D8196]" />
                        Category
                      </label>
                      <input
                        type="text"
                        value={form.category}
                        onChange={(e) => update("category", e.target.value)}
                        placeholder="e.g. Skincare, Supplements, Fitness..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] shadow-2xs transition-all"
                      />
                    </div>
                  </div>

                  {/* Product Type (Read-only summary of Step 1 selection) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#6D8196]" />
                      Product Type
                    </label>
                    <div className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 flex items-center justify-between min-h-[42px]">
                      <span className="truncate">
                        {getCategoryNames() || "None Selected"}
                      </span>
                      <span className="text-[10px] font-bold bg-[#6D8196]/15 text-[#3D4F61] border border-[#6D8196]/30 px-2 py-0.5 rounded-md shrink-0">
                        Selected from Step 1
                      </span>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Remarks</label>
                    <textarea
                      rows={2}
                      value={form.remarks}
                      onChange={(e) => update("remarks", e.target.value)}
                      placeholder="Optional notes or instructions..."
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none shadow-2xs"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition text-xs shadow-2xs cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!form.name.trim() || submitting}
                      onClick={handleSubmit}
                      className="flex-1 py-2.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] active:scale-[0.98] text-white font-bold text-xs shadow-xs disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {submitting ? "Saving..." : "Add Product"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
