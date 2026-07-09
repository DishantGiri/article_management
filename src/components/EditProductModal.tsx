"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Site {
  id: number;
  name: string;
}

interface Category {
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
    trendLink?: string | null;
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

export default function EditProductModal({ isOpen, onClose, onSuccess, product }: EditProductModalProps) {
  const { data: session } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [trendLink, setTrendLink] = useState("");
  const [previewLink, setPreviewLink] = useState("");
  const [remarks, setRemarks] = useState("");

  const [trendLinkError, setTrendLinkError] = useState("");
  const [previewLinkError, setPreviewLinkError] = useState("");

  useEffect(() => {
    if (isOpen && product) {
      setName(product.name || "");
      setSiteId(product.siteId?.toString() || "");
      setCategoryId(product.categoryId?.toString() || "");
      setTrendLink(product.trendLink || "");
      setPreviewLink(product.previewLink || "");
      setRemarks(product.remarks || "");
      setError("");
      setTrendLinkError("");
      setPreviewLinkError("");

      setLoading(true);
      Promise.all([
        fetch("/api/categories").then((r) => r.json()),
        fetch("/api/sites").then((r) => r.json()),
      ])
        .then(([catsData, sitesData]) => {
          setCategories(Array.isArray(catsData) ? catsData : []);
          setSites(Array.isArray(sitesData) ? sitesData : []);
        })
        .catch(() => setError("Failed to load initial metadata"))
        .finally(() => setLoading(false));
    }
  }, [isOpen, product]);

  const handleSubmit = async () => {
    if (!product) return;

    if (!name.trim() || !siteId || !categoryId) {
      setError("Product Name, Site, and Category are required.");
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

    try {
      const mockUserId = session?.user?.id || 1;
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          siteId: parseInt(siteId),
          categoryId: parseInt(categoryId),
          trendLink: trendLink || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Edit Product</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <span className="font-bold">!</span> {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Product Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alpha Whey"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Site *</label>
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="">Select Site...</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="">Select Category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Trend Link</label>
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
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none transition-colors ${
                    trendLinkError ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"
                  }`}
                />
                {trendLinkError && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">{trendLinkError}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Preview Link</label>
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
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none transition-colors ${
                    previewLinkError ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"
                  }`}
                />
                {previewLinkError && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">{previewLinkError}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Remarks</label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!name.trim() || submitting}
                  onClick={handleSubmit}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition text-sm flex items-center justify-center gap-2"
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
