"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Site {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

interface FormData {
  categoryId: string;
  siteId: string;
  name: string;
  trendLink: string;
  previewLink: string;
  remarks: string;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ["Select Category", "Select Site", "Product Details"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = step === idx;
        const done = step > idx;
        return (
          <div key={idx} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                    ? "bg-violet-600 text-white ring-4 ring-violet-200"
                    : "bg-gray-100 text-gray-400 border border-gray-200"
                }`}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx
                )}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  active ? "text-violet-600" : done ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mb-4 rounded transition-all duration-500 ${
                  done ? "bg-emerald-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AddProductPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<FormData>({
    categoryId: "",
    siteId: "",
    name: "",
    trendLink: "",
    previewLink: "",
    remarks: "",
  });

  // Fetch categories on load
  useEffect(() => {
    setLoading(true);
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load categories"))
      .finally(() => setLoading(false));
  }, []);

  // Fetch sites when category changes
  useEffect(() => {
    if (!form.categoryId) return;
    setLoading(true);
    fetch(`/api/sites?categoryId=${form.categoryId}`)
      .then((r) => r.json())
      .then((data) => setSites(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load sites"))
      .finally(() => setLoading(false));
  }, [form.categoryId]);

  const update = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }, []);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          siteId: parseInt(form.siteId),
          categoryId: parseInt(form.categoryId),
          trendLink: form.trendLink || null,
          previewLink: form.previewLink || null,
          remarks: form.remarks || null,
          addedById: typeof window !== "undefined" ? parseInt(localStorage.getItem("mockUserId") || "1") : 1,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create product");
      }

      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryName = () => categories.find(c => String(c.id) === form.categoryId)?.name || "";

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Product Added!</h2>
          <p className="text-gray-500 mb-6">
            <strong className="text-gray-700">{form.name}</strong> has been successfully added to the {getCategoryName()} category.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              id="btn-add-another"
              onClick={() => {
                setForm({ categoryId: "", siteId: "", name: "", trendLink: "", previewLink: "", remarks: "" });
                setStep(1);
                setSuccess(false);
              }}
              className="px-5 py-2.5 rounded-xl border border-violet-200 text-violet-700 font-medium hover:bg-violet-50 transition"
            >
              Add Another
            </button>
            <button
              id="btn-view-products"
              onClick={() => router.push("/products")}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition"
            >
              View Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-500 mt-1">Fill in the details step by step</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <StepIndicator step={step} />

          {/* Error Banner */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* ── STEP 1: Category ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Category</h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No categories found. Please create categories first.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        update("categoryId", String(cat.id));
                        update("siteId", "");
                        setSites([]);
                      }}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        form.categoryId === String(cat.id)
                          ? "border-violet-500 bg-violet-50"
                          : "border-gray-200 hover:border-violet-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-semibold text-gray-800 text-sm truncate">{cat.name}</div>
                      {form.categoryId === String(cat.id) && (
                        <div className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                id="btn-step1-next"
                disabled={!form.categoryId}
                onClick={() => setStep(2)}
                className="w-full mt-6 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── STEP 2: Select Site ─────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Select Site</h2>
              <p className="text-sm text-gray-500 mb-4">
                Showing sites in <span className="font-medium text-violet-600">{getCategoryName()}</span>
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                </div>
              ) : sites.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  No sites found for this category.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {sites.map((site) => (
                    <button
                      key={site.id}
                      id={`btn-site-${site.id}`}
                      onClick={() => update("siteId", String(site.id))}
                      className={`w-full px-4 py-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all duration-150 ${
                        form.siteId === String(site.id)
                          ? "border-violet-500 bg-violet-50"
                          : "border-gray-200 hover:border-violet-300"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        form.siteId === String(site.id) ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        {site.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{site.name}</span>
                      {form.siteId === String(site.id) && (
                        <svg className="w-4 h-4 text-violet-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  id="btn-step2-back"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition"
                >
                  ← Back
                </button>
                <button
                  id="btn-step2-next"
                  disabled={!form.siteId}
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Product Details ─────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Product Details</h2>

              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-product-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Alpha Whey Protein"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                />
              </div>

              {/* Trend Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Trend Link</label>
                <input
                  id="input-trend-link"
                  type="url"
                  value={form.trendLink}
                  onChange={(e) => update("trendLink", e.target.value)}
                  placeholder="https://trends.google.com/..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                />
              </div>

              {/* Preview Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Preview Link</label>
                <input
                  id="input-preview-link"
                  type="url"
                  value={form.previewLink}
                  onChange={(e) => update("previewLink", e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Remarks <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="input-remarks"
                  rows={3}
                  value={form.remarks}
                  onChange={(e) => update("remarks", e.target.value)}
                  placeholder="Any additional notes…"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none transition"
                />
              </div>

              {/* Summary chip */}
              <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1 border border-slate-100">
                <span>Category: <strong className="text-violet-600">{getCategoryName()}</strong></span>
                <span>Site: <strong>{sites.find((s) => String(s.id) === form.siteId)?.name ?? "—"}</strong></span>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  id="btn-step3-back"
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition"
                >
                  ← Back
                </button>
                <button
                  id="btn-submit-product"
                  disabled={!form.name.trim() || submitting}
                  onClick={handleSubmit}
                  className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Add Product ✓"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Product Added Date and Added By are recorded automatically by the system.
        </p>
      </div>
    </div>
  );
}
