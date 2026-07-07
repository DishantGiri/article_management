"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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

function StepIndicator({ step }: { step: number }) {
  const steps = ["Category", "Site", "Details"];
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
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                    ? "bg-indigo-600 text-white ring-2 ring-indigo-200"
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
                className={`text-[10px] font-medium whitespace-nowrap ${
                  active ? "text-indigo-600" : done ? "text-emerald-600" : "text-slate-400"
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

export default function AddProductModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess?: () => void }) {
  const [step, setStep] = useState(1);
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successState, setSuccessState] = useState(false);

  const [form, setForm] = useState<FormData>({
    categoryId: "",
    siteId: "",
    name: "",
    trendLink: "",
    previewLink: "",
    remarks: "",
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSuccessState(false);
      setForm({ categoryId: "", siteId: "", name: "", trendLink: "", previewLink: "", remarks: "" });
      setLoading(true);
      fetch("/api/categories")
        .then((r) => r.json())
        .then((data) => setCategories(Array.isArray(data) ? data : []))
        .catch(() => setError("Failed to load categories"))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

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

      setSuccessState(true);
      if (onSuccess) onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryName = () => categories.find(c => String(c.id) === form.categoryId)?.name || "";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Add New Product</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {successState ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Product Added!</h3>
              <p className="text-sm text-slate-500 mb-6">
                <strong className="text-slate-700">{form.name}</strong> has been successfully added to {getCategoryName()}.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setForm({ categoryId: "", siteId: "", name: "", trendLink: "", previewLink: "", remarks: "" });
                    setStep(1);
                    setSuccessState(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Add Another
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <StepIndicator step={step} />

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                  <span className="font-bold">!</span> {error}
                </div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800">Select Category</h3>
                  {loading ? (
                    <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
                  ) : categories.length === 0 ? (
                    <div className="text-center py-4 text-slate-500 text-sm">No categories found.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            update("categoryId", String(cat.id));
                            update("siteId", "");
                            setSites([]);
                          }}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            form.categoryId === String(cat.id)
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="font-semibold text-slate-800 text-sm truncate">{cat.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    disabled={!form.categoryId}
                    onClick={() => setStep(2)}
                    className="w-full mt-4 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition text-sm"
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800">Select Site in {getCategoryName()}</h3>
                  {loading ? (
                    <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
                  ) : sites.length === 0 ? (
                    <div className="text-center py-4 text-slate-500 text-sm">No sites found.</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {sites.map((site) => (
                        <button
                          key={site.id}
                          onClick={() => update("siteId", String(site.id))}
                          className={`w-full px-3 py-2.5 rounded-lg border flex items-center gap-3 transition-all ${
                            form.siteId === String(site.id)
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-slate-200 hover:border-indigo-200"
                          }`}
                        >
                          <span className="font-semibold text-slate-800 text-sm">{site.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition text-sm"
                    >
                      Back
                    </button>
                    <button
                      disabled={!form.siteId}
                      onClick={() => setStep(3)}
                      className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition text-sm"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Product Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      placeholder="e.g. Alpha Whey"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Trend Link</label>
                    <input
                      type="url"
                      value={form.trendLink}
                      onChange={(e) => update("trendLink", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Preview Link</label>
                    <input
                      type="url"
                      value={form.previewLink}
                      onChange={(e) => update("previewLink", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Remarks</label>
                    <textarea
                      rows={2}
                      value={form.remarks}
                      onChange={(e) => update("remarks", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                    />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition text-sm"
                    >
                      Back
                    </button>
                    <button
                      disabled={!form.name.trim() || submitting}
                      onClick={handleSubmit}
                      className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition text-sm flex items-center justify-center gap-2"
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
