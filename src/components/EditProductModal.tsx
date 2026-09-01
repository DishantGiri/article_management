"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import CustomSelect from "@/components/CustomSelect";
import {
  Package,
  X,
  Globe,
  Tag,
  TrendingUp,
  Link2,
  AlertCircle,
  Building2,
  Layers,
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

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  product: {
    id: number;
    name: string;
    productCategory?: string | null;
    trendLink?: string | null;
    trendLevel?: string | null;
    affiliateName?: string | null;
    previewLink?: string | null;
    remarks?: string | null;
    siteId: number;
    categoryId: number;
  } | null;
}

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

export default function EditProductModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: EditProductModalProps) {
  const { data: session } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [productCategories, setProductCategories] = useState<{ id: number; name: string }[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [category, setCategory] = useState("");
  const [trendLink, setTrendLink] = useState("");
  const [trendLevel, setTrendLevel] = useState("HIGH");
  const [affiliateName, setAffiliateName] = useState("");
  const [customAffiliate, setCustomAffiliate] = useState("");
  const [showCustomAffiliate, setShowCustomAffiliate] = useState(false);

  const [previewLink, setPreviewLink] = useState("");
  const [remarks, setRemarks] = useState("");

  const [trendLinkError, setTrendLinkError] = useState("");
  const [previewLinkError, setPreviewLinkError] = useState("");

  useEffect(() => {
    if (isOpen && product) {
      setName(product.name || "");
      setSiteId(product.siteId?.toString() || "");
      setCategoryId(product.categoryId?.toString() || "");
      setCategory(product.productCategory || "");
      setTrendLink(product.trendLink || "");
      setTrendLevel(product.trendLevel || "HIGH");
      setAffiliateName(product.affiliateName || "");
      setShowCustomAffiliate(false);
      setCustomAffiliate("");
      setPreviewLink(product.previewLink || "");
      setRemarks(product.remarks || "");
      setError("");
      setTrendLinkError("");
      setPreviewLinkError("");

      setLoading(true);
      Promise.all([
        fetch("/api/categories").then((r) => r.json()),
        fetch("/api/product-categories").then((r) => r.json()),
        fetch("/api/sites").then((r) => r.json()),
        fetch("/api/affiliates").then((r) => r.json()),
      ])
        .then(([catsData, prodCatsData, sitesData, affsData]) => {
          setCategories(Array.isArray(catsData) ? catsData : []);
          setProductCategories(Array.isArray(prodCatsData) ? prodCatsData : []);
          setSites(Array.isArray(sitesData) ? sitesData : []);
          setAffiliates(Array.isArray(affsData) ? affsData : []);
        })
        .catch(() => setError("Failed to load initial metadata"))
        .finally(() => setLoading(false));
    }
  }, [isOpen, product]);

  const handleSubmit = async () => {
    if (!product) return;

    if (!name.trim() || !siteId || !categoryId) {
      setError("Product Name, Site, and Product Type are required.");
      return;
    }

    if (trendLinkError || previewLinkError) {
      setError("Please fix the validation errors before submitting.");
      return;
    }

    if (trendLink && !isValidUrl(trendLink)) {
      setError("Please enter a valid Trend Link URL");
      return;
    }

    if (previewLink && !isValidUrl(previewLink)) {
      setError("Please enter a valid Preview Link URL");
      return;
    }

    setSubmitting(true);
    setError("");

    const finalAffiliate = showCustomAffiliate ? customAffiliate.trim() : affiliateName;

    try {
      if (showCustomAffiliate && customAffiliate.trim()) {
        fetch("/api/affiliates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: customAffiliate.trim() }),
        }).catch(() => {});
      }

      const mockUserId = session?.user?.id || 1;
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          siteId: parseInt(siteId),
          categoryId: parseInt(categoryId),
          productCategory: category.trim() || null,
          trendLink: trendLink || null,
          trendLevel: trendLevel || "HIGH",
          affiliateName: finalAffiliate || null,
          previewLink: previewLink || null,
          remarks: remarks || null,
          callerId: mockUserId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update product");
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !product) return null;

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
              <h2 className="text-base font-bold text-white tracking-tight">Edit Product</h2>
              <p className="text-xs text-[#EAEAEA] font-medium">Update details, product type, category & link settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-[#EAEAEA] hover:text-white flex items-center justify-center transition cursor-pointer"
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

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#CBCBCB] border-t-[#6D8196] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Product Name & Affiliate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-[#6D8196]" />
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Product Name"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] transition-all shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#6D8196]" />
                    Affiliate Network / Name
                  </label>
                  {!showCustomAffiliate ? (
                    <CustomSelect
                      value={affiliateName}
                      onChange={(val) => {
                        if (val === "__NEW__") {
                          setShowCustomAffiliate(true);
                          setAffiliateName("");
                        } else {
                          setAffiliateName(val);
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
                        className="flex-1 px-3.5 py-2.5 bg-white border border-[#6D8196] rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] transition-all shadow-2xs"
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

              {/* Site & Product Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#6D8196]" />
                    Site <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={siteId}
                    onChange={(val) => setSiteId(val)}
                    placeholder="Select Site..."
                    options={sites.map((s) => ({ value: String(s.id), label: s.name }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#6D8196]" />
                    Product Type <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={categoryId}
                    onChange={(val) => setCategoryId(val)}
                    placeholder="Select Product Type..."
                    options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                  />
                </div>
              </div>

              {/* Category & Trend Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#6D8196]" />
                    Product Category
                  </label>
                  <CustomSelect
                    value={category}
                    onChange={(val) => setCategory(val)}
                    placeholder="Select Product Category..."
                    searchable={true}
                    searchPlaceholder="Search category..."
                    className="w-full"
                    options={productCategories.map((c) => ({ value: c.name, label: c.name }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#6D8196]" />
                    Trend Level
                  </label>
                  <CustomSelect
                    value={trendLevel}
                    onChange={(val) => setTrendLevel(val)}
                    placeholder="Select Trend Level..."
                    options={[
                      { value: "HIGH", label: "🔥 High Trend" },
                      { value: "MODERATE", label: "📈 Moderate Trend" },
                      { value: "LOW", label: "📉 Low / Stable" },
                    ]}
                  />
                </div>
              </div>

              {/* Trend Link & Preview Link */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#6D8196]" />
                    Trend Link URL
                  </label>
                  <input
                    type="url"
                    value={trendLink}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTrendLink(val);
                      if (val && !isValidUrl(val)) {
                        setTrendLinkError("Must start with http:// or https:// and be a valid URL");
                      } else {
                        setTrendLinkError("");
                      }
                    }}
                    placeholder="https://..."
                    className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none transition-all shadow-2xs ${
                      trendLinkError
                        ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/10"
                        : "border-slate-200 focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
                    }`}
                  />
                  {trendLinkError && (
                    <p className="text-xs font-semibold text-rose-500">{trendLinkError}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#6D8196]" />
                    Preview Link URL
                  </label>
                  <input
                    type="url"
                    value={previewLink}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPreviewLink(val);
                      if (val && !isValidUrl(val)) {
                        setPreviewLinkError("Must start with http:// or https:// and be a valid URL");
                      } else {
                        setPreviewLinkError("");
                      }
                    }}
                    placeholder="https://..."
                    className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none transition-all shadow-2xs ${
                      previewLinkError
                        ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/10"
                        : "border-slate-200 focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
                    }`}
                  />
                  {previewLinkError && (
                    <p className="text-xs font-semibold text-rose-500">{previewLinkError}</p>
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Remarks</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes or instructions..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] transition-all resize-none shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition text-xs cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!name.trim() || submitting}
                  onClick={handleSubmit}
                  className="px-5 py-2.5 bg-[#6D8196] hover:bg-[#5A6D81] active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
