"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { Check, AlertCircle } from "lucide-react";
import { generateSlug } from "@/lib/utils";
import AffiliateMultiSelect from "@/components/AffiliateMultiSelect";

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
  slug: string;
  category: string;
  affiliateName: string;
  trendLink: string;
  previewLink: string;
  remarks: string;
  isNative: boolean;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ["Product Type", "Select Site", "Product Details"];
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
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${done
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                    : active
                      ? "bg-zinc-950 text-white ring-4 ring-zinc-200 dark:bg-white dark:text-zinc-950 dark:ring-zinc-800"
                      : "bg-zinc-100 text-zinc-400 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500"
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
                className={`text-xs font-medium whitespace-nowrap ${active ? "text-zinc-950 dark:text-zinc-100 font-bold" : done ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"
                  }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mb-4 rounded transition-all duration-500 ${done ? "bg-zinc-900 dark:bg-white" : "bg-zinc-200 dark:bg-zinc-700"
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
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [affiliates, setAffiliates] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<FormData>({
    categoryId: "",
    siteId: "",
    name: "",
    slug: "",
    category: "",
    affiliateName: "",
    trendLink: "",
    previewLink: "",
    remarks: "",
    isNative: false,
  });

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  // Real-time Database Duplicate Check State
  const [nameCheckStatus, setNameCheckStatus] = useState<{
    checking: boolean;
    exists?: boolean;
    message?: string;
    conflicts?: Array<{ siteName: string; addedBy: string; country?: string | null }>;
  }>({ checking: false });

  // Restrict access: only SUPER_ADMIN, ADMIN, LINKER can access this page
  useEffect(() => {
    if (session && session.user) {
      const r = session.user.role;
      if (r !== "SUPER_ADMIN" && r !== "ADMIN" && r !== "LINKER") {
        router.replace("/products");
      }
    }
  }, [session, router]);

  // Fetch categories and affiliates on load
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/affiliates").then((r) => r.json()),
    ])
      .then(([catsData, affsData]) => {
        setCategories(Array.isArray(catsData) ? catsData : []);
        setAffiliates(Array.isArray(affsData) ? affsData : []);
      })
      .catch(() => setError("Failed to load initial data"))
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

  // Real-time Database Duplicate Check
  useEffect(() => {
    const trimmed = form.name.trim();
    if (step !== 3 || trimmed.length < 2) {
      setNameCheckStatus({ checking: false });
      return;
    }

    setNameCheckStatus({ checking: true });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/products/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ name: trimmed, key: "single" }],
            siteId: form.siteId || undefined,
            categoryIds: form.categoryId ? [parseInt(form.categoryId)] : undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const result = data.results?.["single"];
          if (result) {
            setNameCheckStatus({
              checking: false,
              exists: result.exists,
              message: result.message,
              conflicts: result.conflicts,
            });
            return;
          }
        }
        setNameCheckStatus({ checking: false });
      } catch (err) {
        console.error("Check failed:", err);
        setNameCheckStatus({ checking: false });
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [step, form.name, form.siteId, form.categoryId]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const update = useCallback((field: keyof FormData, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name" && typeof value === "string" && !isSlugManuallyEdited) {
        next.slug = generateSlug(value);
      }
      return next;
    });
    setError("");

    if (typeof value === "string" && (field === "trendLink" || field === "previewLink")) {
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
  }, [isSlugManuallyEdited]);

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
    if (form.name.trim().length < 2) {
      setError("Product name must be at least 2 characters.");
      return;
    }
    if (nameCheckStatus.exists) {
      toast(`Warning: ${nameCheckStatus.message}. Proceeding — the server will confirm.`, {
        style: { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" },
        duration: 4000,
      });
      // Don't return — let the server do final validation
    }
    const finalAffiliate = form.affiliateName.trim();
    if (!finalAffiliate) {
      setError("Affiliate Network is compulsory (choose at least one or 'No Affiliate').");
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

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug?.trim() ? generateSlug(form.slug) : generateSlug(form.name),
          categoryIds: [parseInt(form.categoryId)],
          productCategory: form.category.trim() || null,
          affiliateName: finalAffiliate || null,
          trendLink: form.trendLink || null,
          previewLink: form.previewLink.trim() || null,
          remarks: form.remarks || null,
          isNative: form.isNative,
          addedById: session?.user?.id || 1,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create product");
      }

      setSuccess(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
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
                setForm({ categoryId: "", siteId: "", name: "", slug: "", category: "", affiliateName: "", trendLink: "", previewLink: "", remarks: "", isNative: false });
                setIsSlugManuallyEdited(false);
                setNameCheckStatus({ checking: false });
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

          {/* ── STEP 1: Product Type ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Product Type</h2>
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
                      className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${form.categoryId === String(cat.id)
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
                      className={`w-full px-4 py-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all duration-150 ${form.siteId === String(site.id)
                          ? "border-violet-500 bg-violet-50"
                          : "border-gray-200 hover:border-violet-300"
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${form.siteId === String(site.id) ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-600"
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
                <div className="relative">
                  <input
                    id="input-product-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g. Alpha Whey Protein"
                    className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none transition ${
                      form.name.trim().length > 0 && form.name.trim().length < 2
                        ? "border-rose-400 focus:ring-2 focus:ring-rose-300"
                        : nameCheckStatus.exists
                        ? "border-red-500 bg-red-50/30 text-red-900 focus:ring-2 focus:ring-red-400"
                        : nameCheckStatus.exists === false && form.name.trim().length >= 2
                        ? "border-emerald-500 focus:ring-2 focus:ring-emerald-400"
                        : "border-gray-300 focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                    }`}
                  />
                  {nameCheckStatus.checking && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-gray-400">
                      <div className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {form.name.trim().length > 0 && form.name.trim().length < 2 ? (
                  <p className="text-xs font-semibold text-rose-500 mt-1">
                    Product name must be at least 2 characters.
                  </p>
                ) : nameCheckStatus.checking ? (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <span>Checking product availability...</span>
                  </p>
                ) : nameCheckStatus.exists ? (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{nameCheckStatus.message}</span>
                  </p>
                ) : nameCheckStatus.exists === false && form.name.trim().length >= 2 ? (
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-1 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Available to add</span>
                  </p>
                ) : null}
              </div>

              {/* Product Slug (Auto-generated & Editable) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Product Slug <span className="text-xs text-gray-400 font-normal">(Auto-generated)</span>
                  </label>
                  {isSlugManuallyEdited && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSlugManuallyEdited(false);
                        setForm((prev) => ({ ...prev, slug: generateSlug(prev.name) }));
                      }}
                      className="text-xs font-semibold text-violet-600 hover:underline"
                    >
                      Reset to Auto
                    </button>
                  )}
                </div>
                <input
                  id="input-product-slug"
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setIsSlugManuallyEdited(true);
                    setForm((prev) => ({
                      ...prev,
                      slug: e.target.value.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-"),
                    }));
                  }}
                  placeholder="e.g. alpha-whey-protein"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                />
              </div>

              {/* Native Product Toggle */}
              <div
                className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition cursor-pointer"
                onClick={() => update("isNative", !form.isNative)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Native Product</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        form.isNative
                          ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                          : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      {form.isNative ? "Native" : "Standard"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Toggle whether this product is a native product
                  </p>
                </div>
                <button
                  type="button"
                  id="toggle-is-native"
                  role="switch"
                  aria-checked={form.isNative}
                  onClick={(e) => { e.stopPropagation(); update("isNative", !form.isNative); }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-zinc-950/30 dark:focus:ring-white/30 focus:ring-offset-2 ${
                    form.isNative ? "bg-zinc-950 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-600"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-sm ring-0 transition duration-200 ease-in-out ${
                      form.isNative
                        ? "translate-x-5 bg-white dark:bg-zinc-950"
                        : "translate-x-0 bg-white dark:bg-zinc-300"
                    }`}
                  />
                </button>
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
                  className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none transition ${fieldErrors.trendLink
                      ? "border-rose-400 focus:ring-2 focus:ring-rose-400"
                      : "border-gray-300 focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                    }`}
                />
                {fieldErrors.trendLink && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">{fieldErrors.trendLink}</p>
                )}
              </div>

              {/* Affiliate Network Multi-Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>
                    Affiliate Network <span className="text-red-500">*</span>
                  </span>
                  <span className="text-xs text-gray-400 font-normal">
                    Select multiple or No Affiliate
                  </span>
                </label>
                <AffiliateMultiSelect
                  value={form.affiliateName}
                  onChange={(val) => update("affiliateName", val)}
                  affiliates={affiliates}
                  placeholder="Select Affiliate Network(s)... *"
                  triggerClassName="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent flex items-center justify-between transition"
                  onAddCustomAffiliate={async (name) => {
                    const res = await fetch("/api/affiliates", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setAffiliates((prev) => [...prev, data]);
                    }
                  }}
                />
              </div>

              {/* Preview Link & Category Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Preview Link <span className="text-xs text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="input-preview-link"
                    type="url"
                    value={form.previewLink}
                    onChange={(e) => update("previewLink", e.target.value)}
                    placeholder="https://... (optional)"
                    className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none transition ${fieldErrors.previewLink
                        ? "border-rose-400 focus:ring-2 focus:ring-rose-400"
                        : "border-gray-300 focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
                      }`}
                  />
                  {fieldErrors.previewLink && (
                    <p className="text-[11px] font-semibold text-rose-500 mt-1">{fieldErrors.previewLink}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                  <input
                    id="input-product-category"
                    type="text"
                    value={form.category}
                    onChange={(e) => update("category", e.target.value)}
                    placeholder="e.g. Skincare, Supplements, Fitness..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] transition"
                  />
                </div>
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
                <span>Product Type: <strong className="text-[#6D8196]">{getCategoryName()}</strong></span>
                <span>Site: <strong>{sites.find((s) => String(s.id) === form.siteId)?.name ?? "-"}</strong></span>
                <span>Native: <strong className={form.isNative ? "text-violet-600 font-bold" : "text-gray-600"}>{form.isNative ? "Yes" : "No"}</strong></span>
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
                  disabled={submitting || nameCheckStatus.exists}
                  onClick={handleSubmit}
                  className="flex-1 py-3 rounded-xl bg-zinc-950 text-white font-semibold hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Add Product"
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
