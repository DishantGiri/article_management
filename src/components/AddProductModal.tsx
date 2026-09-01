"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
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
  ListPlus,
  ClipboardList,
  Table,
  FileSpreadsheet,
  Trash2,
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

export interface SpreadsheetRow {
  name: string;
  category: string;
  affiliateName: string;
  trendLevel: string;
  trendLink: string;
  previewLink: string;
  remarks: string;
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

function StepIndicator({ step, entryMode }: { step: number; entryMode: "bulk" | "single" }) {
  const steps = entryMode === "bulk"
    ? ["Product Type", "Bulk Products (Google Sheet)"]
    : ["Product Type", "Preview Sites", "Details"];

  return (
    <div className={`flex items-center gap-0 ${entryMode === "bulk" ? "mb-3" : "mb-6"}`}>
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

  // Bulk entry / Google Sheets mode (DEFAULT: "bulk")
  const [entryMode, setEntryMode] = useState<"single" | "bulk">("bulk");
  const [bulkPasteText, setBulkPasteText] = useState("");
  const [spreadsheetRows, setSpreadsheetRows] = useState<SpreadsheetRow[]>([
    { name: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" },
  ]);

  // Batch Fill Helpers
  const [batchCategory, setBatchCategory] = useState("");
  const [batchAffiliate, setBatchAffiliate] = useState("");
  const [batchTrendLevel, setBatchTrendLevel] = useState("HIGH");
  const [showSitesDrawer, setShowSitesDrawer] = useState(false);

  const parseTextToRows = (text: string) => {
    setBulkPasteText(text);
    const lines = text
      .split(/\r?\n/)
      .flatMap((line) => {
        if (line.includes(",") && !line.includes("http://") && !line.includes("https://")) {
          return line.split(",");
        }
        return [line];
      })
      .map((line) => line.trim().replace(/^[-*•\d.)\s]+/, "").trim())
      .filter((line) => line.length > 0);

    const uniqueNames = Array.from(new Set(lines));
    if (uniqueNames.length === 0) return;

    const newRows: SpreadsheetRow[] = uniqueNames.map((n) => ({
      name: n,
      category: batchCategory || form.category || "",
      affiliateName: batchAffiliate || form.affiliateName || "",
      trendLevel: batchTrendLevel || form.trendLevel || "HIGH",
      trendLink: "",
      previewLink: "",
      remarks: "",
    }));

    setSpreadsheetRows(newRows);
    toast.success(`Imported ${newRows.length} products into spreadsheet table!`);
  };

  const updateSpreadsheetRow = (index: number, field: keyof SpreadsheetRow, value: string) => {
    setSpreadsheetRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addSpreadsheetRow = () => {
    setSpreadsheetRows((prev) => [
      ...prev,
      {
        name: "",
        category: batchCategory || form.category || "",
        affiliateName: batchAffiliate || form.affiliateName || "",
        trendLevel: batchTrendLevel || "HIGH",
        trendLink: "",
        previewLink: "",
        remarks: "",
      },
    ]);
  };

  const removeSpreadsheetRow = (index: number) => {
    setSpreadsheetRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        return [{ name: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" }];
      }
      return next;
    });
  };

  const applyBatchToAll = () => {
    setSpreadsheetRows((prev) =>
      prev.map((row) => ({
        ...row,
        category: batchCategory ? batchCategory : row.category,
        affiliateName: batchAffiliate ? batchAffiliate : row.affiliateName,
        trendLevel: batchTrendLevel ? batchTrendLevel : row.trendLevel,
      }))
    );
    toast.success("Applied batch values to all spreadsheet rows!");
  };

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
      setEntryMode("bulk");
      setBulkPasteText("");
      setSpreadsheetRows([
        { name: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" },
      ]);
      setBatchCategory("");
      setBatchAffiliate("");
      setBatchTrendLevel("HIGH");
      setShowSitesDrawer(false);
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
    if (entryMode === "bulk") {
      const validRows = spreadsheetRows.filter((r) => r.name.trim().length > 0);
      if (validRows.length === 0) {
        setError("Please enter or paste at least one product name in the spreadsheet table.");
        toast.error("Please enter or paste at least one product name in the spreadsheet table.");
        return;
      }

      for (let i = 0; i < validRows.length; i++) {
        const r = validRows[i];
        const rowNum = i + 1;
        if (!r.name.trim()) {
          const msg = `Row #${rowNum}: Product Name is compulsory.`;
          setError(msg);
          toast.error(msg);
          return;
        }
        if (!r.category.trim()) {
          const msg = `Row #${rowNum} ("${r.name}"): Category is compulsory.`;
          setError(msg);
          toast.error(msg);
          return;
        }
        if (!r.affiliateName.trim()) {
          const msg = `Row #${rowNum} ("${r.name}"): Affiliate Network is compulsory.`;
          setError(msg);
          toast.error(msg);
          return;
        }
        if (!r.trendLevel || !r.trendLevel.trim()) {
          const msg = `Row #${rowNum} ("${r.name}"): Trend Level is compulsory.`;
          setError(msg);
          toast.error(msg);
          return;
        }
        if (!r.trendLink.trim()) {
          const msg = `Row #${rowNum} ("${r.name}"): Trend Link URL is compulsory.`;
          setError(msg);
          toast.error(msg);
          return;
        }
        if (!isValidUrl(r.trendLink)) {
          const msg = `Row #${rowNum} ("${r.name}"): Trend Link must start with http:// or https:// and be a valid URL.`;
          setError(msg);
          toast.error(msg);
          return;
        }
        if (!r.previewLink.trim()) {
          const msg = `Row #${rowNum} ("${r.name}"): Preview Link URL is compulsory.`;
          setError(msg);
          toast.error(msg);
          return;
        }
        if (!isValidUrl(r.previewLink)) {
          const msg = `Row #${rowNum} ("${r.name}"): Preview Link must start with http:// or https:// and be a valid URL.`;
          setError(msg);
          toast.error(msg);
          return;
        }
      }

      setSubmitting(true);
      setError("");

      try {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            products: validRows.map((r) => ({
              name: r.name.trim(),
              productCategory: r.category.trim(),
              affiliateName: r.affiliateName.trim(),
              trendLevel: r.trendLevel || "HIGH",
              trendLink: r.trendLink.trim(),
              previewLink: r.previewLink.trim(),
              remarks: r.remarks.trim() || null,
            })),
            categoryIds: form.categoryIds,
            excludedSiteIds,
            addedById: session?.user?.id || 1,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create products");
        }

        toast.success(`Successfully created ${validRows.length} products!`);
        setSuccessState(true);
        if (onSuccess) onSuccess();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Single mode submission
    if (!form.name.trim()) {
      setError("Product Name is compulsory.");
      toast.error("Product Name is compulsory.");
      return;
    }
    if (!form.category.trim()) {
      setError("Category is compulsory.");
      toast.error("Category is compulsory.");
      return;
    }
    const finalAffiliate = showCustomAffiliate ? customAffiliate.trim() : form.affiliateName.trim();
    if (!finalAffiliate) {
      setError("Affiliate Network is compulsory.");
      toast.error("Affiliate Network is compulsory.");
      return;
    }
    if (!form.trendLevel || !form.trendLevel.trim()) {
      setError("Trend Level is compulsory.");
      toast.error("Trend Level is compulsory.");
      return;
    }
    if (!form.trendLink.trim()) {
      setError("Trend Link URL is compulsory.");
      toast.error("Trend Link URL is compulsory.");
      return;
    }
    if (!isValidUrl(form.trendLink)) {
      setError("Please enter a valid Trend Link URL (must start with http:// or https://)");
      toast.error("Invalid Trend Link URL.");
      return;
    }
    if (!form.previewLink.trim()) {
      setError("Preview Link URL is compulsory.");
      toast.error("Preview Link URL is compulsory.");
      return;
    }
    if (!isValidUrl(form.previewLink)) {
      setError("Please enter a valid Preview Link URL (must start with http:// or https://)");
      toast.error("Invalid Preview Link URL.");
      return;
    }
    if (Object.keys(fieldErrors).length > 0) {
      setError("Please fix the link validation errors before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");

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

      toast.success("Successfully added product!");
      setSuccessState(true);
      if (onSuccess) onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
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

  const userRole = session?.user?.role;
  const canAddProduct = userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "LINKER";

  if (!isOpen || !canAddProduct) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-2 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
      <div className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col border border-slate-100 transition-all duration-300 ${
        entryMode === "bulk" && step === 2
          ? "w-[99vw] max-w-[99.2vw] h-[98vh] max-h-[98vh]"
          : "max-w-2xl max-h-[92vh]"
      }`}>
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-3.5 bg-[#4A4A4A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6D8196]/30 border border-[#6D8196]/40 flex items-center justify-center text-white shadow-inner">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Add New Product</h2>
              <p className="text-xs text-[#EAEAEA] font-medium">
                {entryMode === "bulk" && step === 2
                  ? "Bulk Spreadsheet Mode — Full-Width Google Sheets Style Table"
                  : "Select product type, websites, trend rating & affiliate info"}
              </p>
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
        <div className={`overflow-y-auto flex-1 flex flex-col ${entryMode === "bulk" && step === 2 ? "p-3 sm:p-4" : "p-5 sm:p-6"}`}>
          {successState ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                {entryMode === "bulk" ? "Products Added Successfully!" : "Product Added Successfully!"}
              </h3>
              <p className="text-xs text-slate-500 font-medium mb-6">
                {entryMode === "bulk"
                  ? `${spreadsheetRows.filter((r) => r.name.trim()).length} products have been added to ${getCategoryNames()}.`
                  : `${form.name} has been added to ${getCategoryNames()}.`}
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
                    setSpreadsheetRows([
                      { name: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" },
                    ]);
                    setBulkPasteText("");
                    setStep(1);
                    setSuccessState(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Add Another
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-[#6D8196] text-white text-xs font-bold hover:bg-[#5A6D81] transition cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <StepIndicator step={step} entryMode={entryMode} />

              {error && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* STEP 1: Choose Product Type */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#6D8196]" />
                        Select Product Type <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-[#737373] mt-0.5">
                        Choose the product type for your products (e.g. Ecomm, Supplement)
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowAddCat(!showAddCat)}
                        className="text-xs font-bold text-[#6D8196] hover:text-[#5A6D81] flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {showAddCat ? "Cancel" : "Add Product Type"}
                      </button>
                    )}
                  </div>

                  {showAddCat && (
                    <form onSubmit={handleInlineAddCat} className="p-3 bg-[#FAF9F5] rounded-xl border border-[#CBCBCB]/60 space-y-2">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Product type name (e.g. Skin Care, Ecomm, Supplements)"
                        className="w-full px-3 py-2 bg-white border border-[#CBCBCB] rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#6D8196]"
                      />
                      <button
                        type="submit"
                        disabled={addingCat || !newCatName.trim()}
                        className="w-full py-1.5 bg-[#6D8196] text-white rounded-lg text-xs font-bold hover:bg-[#5A6D81] disabled:opacity-50 transition cursor-pointer shadow-xs"
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

              {/* STEP 2: BULK SPREADSHEET MODE (DEFAULT) */}
              {step === 2 && entryMode === "bulk" && (
                <div className="space-y-4">
                  {/* Mode Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-[#6D8196]" />
                          Bulk Products Spreadsheet (Google Sheets Style)
                        </span>
                        <span className="text-[10px] font-extrabold bg-[#6D8196]/15 text-[#3D4F61] px-2 py-0.5 rounded-md border border-[#6D8196]/30">
                          Default
                        </span>
                      </div>
                      <p className="text-[11px] text-[#737373] mt-0.5">
                        Selected Type: <strong className="text-slate-800">{getCategoryNames()}</strong> • Direct paste 10+ products or edit directly in the table
                      </p>
                    </div>

                    <div className="inline-flex p-1 bg-[#FAF9F5] border border-[#CBCBCB]/70 rounded-xl shrink-0 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setEntryMode("bulk")}
                        className="px-3 py-1 rounded-lg text-xs font-bold transition bg-[#6D8196] text-white shadow-2xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Table className="w-3.5 h-3.5" />
                        Bulk Spreadsheet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntryMode("single")}
                        className="px-3 py-1 rounded-lg text-xs font-bold transition text-[#737373] hover:text-[#4A4A4A] cursor-pointer"
                      >
                        Single Product Form
                      </button>
                    </div>
                  </div>

                  {/* Control Center: Side-by-Side Direct Paste & Batch Fill Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0">
                    {/* Card 1: Direct Paste Box (6 columns) */}
                    <div className="lg:col-span-6 bg-[#FAF9F5] border border-[#CBCBCB] rounded-xl p-3 flex flex-col justify-between shadow-2xs hover:border-[#6D8196]/60 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-[#4A4A4A] flex items-center gap-1.5 uppercase tracking-wider">
                          <ClipboardList className="w-3.5 h-3.5 text-[#6D8196]" />
                          1. Direct Paste Products
                          <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const text = await navigator.clipboard.readText();
                                if (text) parseTextToRows(text);
                              } catch {
                                toast.error("Please paste directly into the box");
                              }
                            }}
                            className="px-2 py-0.5 text-[11px] font-bold text-[#6D8196] bg-white border border-[#6D8196]/30 hover:bg-[#6D8196]/10 rounded-md transition cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <ClipboardList className="w-3 h-3" />
                            Paste Clipboard
                          </button>
                          {bulkPasteText && (
                            <button
                              type="button"
                              onClick={() => {
                                setBulkPasteText("");
                                setSpreadsheetRows([{ name: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" }]);
                              }}
                              className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        value={bulkPasteText}
                        onChange={(e) => parseTextToRows(e.target.value)}
                        placeholder={"Paste 10+ product names (one per line)...\nExample:\nAlpha Whey Protein\nCreatine Monohydrate 5000\nOmega-3 Triple Strength"}
                        className="w-full px-3 py-2 text-xs font-semibold bg-white border border-[#CBCBCB] rounded-lg text-slate-900 focus:outline-none focus:border-[#6D8196] focus:ring-1 focus:ring-[#6D8196] shadow-2xs resize-none font-mono placeholder:font-sans placeholder:text-slate-400 leading-relaxed"
                      />

                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1.5">
                        <span className="flex items-center gap-1.5 text-[#3D4F61]">
                          {spreadsheetRows.filter((r) => r.name.trim()).length > 0 ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                              <strong className="text-emerald-700 font-bold">{spreadsheetRows.filter((r) => r.name.trim()).length}</strong> product(s) in spreadsheet
                            </>
                          ) : (
                            "Paste from Excel, Google Sheets, or notepad"
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Auto-populates table</span>
                      </div>
                    </div>

                    {/* Card 2: Batch Fill & Sites Toolbar (6 columns) */}
                    <div className="lg:col-span-6 bg-white border border-[#CBCBCB] rounded-xl p-3 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#4A4A4A] flex items-center gap-1.5 uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-[#6D8196]" />
                          2. Batch Fill All Rows
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSitesDrawer(!showSitesDrawer)}
                          className="px-2 py-0.5 text-[11px] font-bold text-[#3D4F61] bg-[#FAF9F5] hover:bg-[#6D8196]/10 border border-[#CBCBCB] rounded-md transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Globe className="w-3 h-3 text-[#6D8196]" />
                          {activeSites.length} Sites Included {showSitesDrawer ? "▲" : "▼"}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-1">
                        <div>
                          <label className="block text-[10px] font-bold text-[#737373] uppercase mb-0.5">Category</label>
                          <CustomSelect
                            value={batchCategory}
                            onChange={(val) => setBatchCategory(val)}
                            placeholder="Select Category..."
                            searchable={true}
                            searchPlaceholder="Search category..."
                            className="w-full"
                            triggerClassName="w-full px-2.5 py-1.5 bg-white border border-[#CBCBCB] hover:border-[#6D8196] rounded-lg text-xs font-medium text-slate-800 focus:outline-none"
                            options={categories.map((c) => ({ value: c.name, label: c.name }))}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#737373] uppercase mb-0.5">Affiliate Network</label>
                          <CustomSelect
                            value={batchAffiliate}
                            onChange={(val) => setBatchAffiliate(val)}
                            placeholder="Select Affiliate..."
                            searchable={true}
                            searchPlaceholder="Search affiliate..."
                            allowCustom={true}
                            className="w-full"
                            triggerClassName="w-full px-2.5 py-1.5 bg-white border border-[#CBCBCB] hover:border-[#6D8196] rounded-lg text-xs font-medium text-slate-800 focus:outline-none"
                            options={affiliates.map((aff) => ({ value: aff.name, label: aff.name }))}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#737373] uppercase mb-0.5">Trend Level</label>
                          <CustomSelect
                            value={batchTrendLevel}
                            onChange={(val) => setBatchTrendLevel(val)}
                            className="w-full"
                            triggerClassName="w-full px-2.5 py-1.5 bg-white border border-[#CBCBCB] hover:border-[#6D8196] rounded-lg text-xs font-medium text-slate-800"
                            options={[
                              { value: "HIGH", label: "🔥 High Trend" },
                              { value: "MODERATE", label: "📈 Moderate Trend" },
                              { value: "LOW", label: "📉 Low / Stable" },
                            ]}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={applyBatchToAll}
                        className="w-full py-1.5 bg-[#FAF9F5] hover:bg-[#6D8196]/15 hover:border-[#6D8196] border border-[#CBCBCB] text-[#3D4F61] text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs mt-1"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#6D8196]" />
                        Apply Batch Attributes to All Rows
                      </button>
                    </div>
                  </div>

                  {/* Sites Exclusion / Customization Collapsible */}
                  {showSitesDrawer && (
                    <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#CBCBCB]/80 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs font-bold text-[#4A4A4A]">
                        <span>Included Websites for ({getCategoryNames()})</span>
                        <span className="text-[11px] text-slate-500 font-medium">Click to exclude any site from this upload</span>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {previewSites.map((site: any) => {
                          const isExcluded = excludedSiteIds.includes(site.id);
                          return (
                            <button
                              key={site.id}
                              type="button"
                              onClick={() => {
                                setExcludedSiteIds((prev) =>
                                  isExcluded ? prev.filter((id) => id !== site.id) : [...prev, site.id]
                                );
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                                isExcluded
                                  ? "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-60"
                                  : "bg-white text-slate-800 border-[#6D8196]/40 font-bold shadow-2xs"
                              }`}
                            >
                              <span>{site.name}</span>
                              {isExcluded ? <Plus className="w-3 h-3 text-slate-400" /> : <Check className="w-3 h-3 text-[#6D8196]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 3. The Google Sheets Style Table */}
                  <div className="border border-[#CBCBCB] rounded-2xl overflow-hidden shadow-xs bg-white flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto max-h-[58vh] overflow-y-auto flex-1">
                      <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                        <thead className="bg-[#FAF9F5] sticky top-0 z-10 border-b border-[#CBCBCB] text-[#4A4A4A] text-[11px] font-extrabold uppercase tracking-wider">
                          <tr>
                            <th className="w-10 py-2.5 px-2 text-center border-r border-[#CBCBCB]/60">#</th>
                            <th className="w-[23%] py-2.5 px-3 border-r border-[#CBCBCB]/60">Product Name <span className="text-rose-500">*</span></th>
                            <th className="w-[11%] py-2.5 px-3 border-r border-[#CBCBCB]/60">Category <span className="text-rose-500">*</span></th>
                            <th className="w-[16%] py-2.5 px-3 border-r border-[#CBCBCB]/60">Affiliate Network <span className="text-rose-500">*</span></th>
                            <th className="w-[11%] py-2.5 px-3 border-r border-[#CBCBCB]/60">Trend Level <span className="text-rose-500">*</span></th>
                            <th className="w-[14%] py-2.5 px-3 border-r border-[#CBCBCB]/60">Trend Link <span className="text-rose-500">*</span></th>
                            <th className="w-[14%] py-2.5 px-3 border-r border-[#CBCBCB]/60">Preview Link <span className="text-rose-500">*</span></th>
                            <th className="w-[11%] py-2.5 px-3 border-r border-[#CBCBCB]/60">Remarks</th>
                            <th className="w-10 py-2.5 px-1 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {spreadsheetRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors group">
                              <td className="py-1 px-2 text-center text-slate-400 font-bold bg-slate-50/40 border-r border-[#CBCBCB]/40">
                                {idx + 1}
                              </td>
                              <td className="py-1 px-2 border-r border-[#CBCBCB]/40">
                                <input
                                  type="text"
                                  value={row.name}
                                  onChange={(e) => updateSpreadsheetRow(idx, "name", e.target.value)}
                                  placeholder={`Product #${idx + 1} name *`}
                                  className="w-full px-2 py-1.5 text-xs font-bold text-slate-900 bg-transparent focus:bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6D8196]"
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-[#CBCBCB]/40 min-w-[150px]">
                                <CustomSelect
                                  value={row.category}
                                  onChange={(val) => updateSpreadsheetRow(idx, "category", val)}
                                  placeholder="Select Category *"
                                  searchable={true}
                                  searchPlaceholder="Search category..."
                                  portal={true}
                                  className="w-full"
                                  triggerClassName="w-full px-2 py-1.5 bg-white border border-[#CBCBCB]/60 hover:border-[#6D8196] rounded-lg text-xs font-medium text-slate-800 focus:outline-none"
                                  options={categories.map((c) => ({ value: c.name, label: c.name }))}
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-[#CBCBCB]/40">
                                <CustomSelect
                                  value={row.affiliateName}
                                  onChange={(val) => updateSpreadsheetRow(idx, "affiliateName", val)}
                                  placeholder="Select Affiliate *"
                                  searchable={true}
                                  searchPlaceholder="Search affiliate..."
                                  allowCustom={true}
                                  portal={true}
                                  minWidth={220}
                                  className="w-full"
                                  triggerClassName="w-full px-2 py-1.5 text-xs text-slate-800 bg-transparent hover:bg-white border border-transparent hover:border-[#CBCBCB] focus:border-[#6D8196] rounded-lg transition-all"
                                  options={affiliates.map((aff) => ({ value: aff.name, label: aff.name }))}
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-[#CBCBCB]/40">
                                <CustomSelect
                                  value={row.trendLevel}
                                  onChange={(val) => updateSpreadsheetRow(idx, "trendLevel", val)}
                                  portal={true}
                                  minWidth={140}
                                  className="w-full"
                                  triggerClassName="w-full px-2 py-1.5 text-xs font-semibold text-slate-800 bg-transparent hover:bg-white border border-transparent hover:border-[#CBCBCB] focus:border-[#6D8196] rounded-lg transition-all"
                                  options={[
                                    { value: "HIGH", label: "🔥 High" },
                                    { value: "MODERATE", label: "📈 Moderate" },
                                    { value: "LOW", label: "📉 Low" },
                                  ]}
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-[#CBCBCB]/40">
                                <input
                                  type="url"
                                  value={row.trendLink}
                                  onChange={(e) => updateSpreadsheetRow(idx, "trendLink", e.target.value)}
                                  placeholder="https://... *"
                                  className="w-full px-2 py-1.5 text-xs font-mono text-slate-800 bg-transparent focus:bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6D8196]"
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-[#CBCBCB]/40">
                                <input
                                  type="url"
                                  value={row.previewLink}
                                  onChange={(e) => updateSpreadsheetRow(idx, "previewLink", e.target.value)}
                                  placeholder="https://... *"
                                  className="w-full px-2 py-1.5 text-xs font-mono text-slate-800 bg-transparent focus:bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6D8196]"
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-[#CBCBCB]/40">
                                <input
                                  type="text"
                                  value={row.remarks}
                                  onChange={(e) => updateSpreadsheetRow(idx, "remarks", e.target.value)}
                                  placeholder="Notes..."
                                  className="w-full px-2 py-1.5 text-xs text-slate-800 bg-transparent focus:bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6D8196]"
                                />
                              </td>
                              <td className="py-1 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeSpreadsheetRow(idx)}
                                  className="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer mx-auto"
                                  title="Delete row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-4 py-2.5 bg-[#FAF9F5] border-t border-[#CBCBCB] flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={addSpreadsheetRow}
                        className="font-bold text-[#6D8196] hover:text-[#5A6D81] flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-[#CBCBCB] shadow-2xs hover:bg-slate-50 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Blank Row
                      </button>

                      <div className="flex items-center gap-3 text-slate-500 font-semibold">
                        <span>{spreadsheetRows.filter((r) => r.name.trim()).length} Products in Sheet</span>
                        <span>•</span>
                        <span>{activeSites.length} Preview Sites included</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition text-xs shadow-2xs cursor-pointer"
                    >
                      Back to Product Type
                    </button>
                    <button
                      type="button"
                      disabled={spreadsheetRows.filter((r) => r.name.trim()).length === 0 || submitting}
                      onClick={handleSubmit}
                      className="flex-1 py-2.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] active:scale-[0.98] text-white font-bold text-xs shadow-xs disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        "Saving Products..."
                      ) : (
                        `Add ${spreadsheetRows.filter((r) => r.name.trim()).length} Products to ${getCategoryNames() || "Selected Type"}`
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PREVIEW SITES (IF IN SINGLE MODE) */}
              {step === 2 && entryMode === "single" && (
                <div className="space-y-4">
                  {/* Mode Switcher */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-bold text-[#4A4A4A] uppercase tracking-wider">
                        Product Entry Mode
                      </span>
                      <p className="text-[11px] text-[#737373]">
                        Switch to Bulk Spreadsheet or continue with Single Product Form
                      </p>
                    </div>

                    <div className="inline-flex p-1 bg-[#FAF9F5] border border-[#CBCBCB]/70 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setEntryMode("bulk")}
                        className="px-3 py-1 rounded-lg text-xs font-bold transition text-[#737373] hover:text-[#4A4A4A] cursor-pointer flex items-center gap-1.5"
                      >
                        <Table className="w-3.5 h-3.5" />
                        Bulk Spreadsheet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntryMode("single")}
                        className="px-3 py-1 rounded-lg text-xs font-bold transition bg-[#6D8196] text-white shadow-2xs cursor-pointer"
                      >
                        Single Product Form
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#6D8196]" />
                      Associated Websites ({getCategoryNames()})
                    </label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowAddSite(!showAddSite)}
                        className="text-xs font-bold text-[#6D8196] hover:text-[#5A6D81] flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {showAddSite ? "Cancel" : "Add Website"}
                      </button>
                    )}
                  </div>

                  {showAddSite && (
                    <form onSubmit={handleInlineAddSite} className="p-3 bg-[#FAF9F5] rounded-xl border border-[#CBCBCB]/60 space-y-2">
                      <input
                        type="text"
                        value={newSiteName}
                        onChange={(e) => setNewSiteName(e.target.value)}
                        placeholder="Site Name (e.g. Health Daily)"
                        className="w-full px-3 py-2 bg-white border border-[#CBCBCB] rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#6D8196]"
                      />
                      <input
                        type="url"
                        value={newSiteUrl}
                        onChange={(e) => setNewSiteUrl(e.target.value)}
                        placeholder="Site URL (https://...)"
                        className="w-full px-3 py-2 bg-white border border-[#CBCBCB] rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#6D8196]"
                      />
                      <button
                        type="submit"
                        disabled={addingSite || !newSiteName.trim()}
                        className="w-full py-1.5 bg-[#6D8196] text-white rounded-lg text-xs font-bold hover:bg-[#5A6D81] disabled:opacity-50 transition cursor-pointer shadow-xs"
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
                                : "bg-[#FAF9F5] border-[#CBCBCB]/60 text-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold truncate">{site.name}</span>
                              {site.url && (
                                <span className="text-[11px] text-slate-400 font-mono truncate hidden sm:inline">
                                  ({site.url})
                                </span>
                              )}
                              {isExcluded ? (
                                <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md font-bold shrink-0">
                                  Excluded
                                </span>
                              ) : (
                                <span className="text-[10px] bg-[#6D8196]/15 text-[#3D4F61] px-2 py-0.5 rounded-md font-bold border border-[#6D8196]/30 shrink-0">
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
                                  ? "text-[#6D8196] hover:bg-[#6D8196]/10"
                                  : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              }`}
                              title={isExcluded ? "Re-include this site" : "Remove/Deselect this site"}
                            >
                              {isExcluded ? (
                                <span className="text-[11px] font-bold text-[#6D8196]">Re-include</span>
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

              {/* STEP 3: DETAILS (IF IN SINGLE MODE) */}
              {step === 3 && entryMode === "single" && (
                <div className="space-y-4">
                  {/* Grid 2-Column: Product Name & Affiliate Dropdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Product Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-[#6D8196]" />
                        Product Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="e.g. Alpha Whey"
                        className="w-full px-3.5 py-2.5 bg-white border border-[#CBCBCB] rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] transition-all shadow-2xs"
                      />
                    </div>

                    {/* Affiliate Network Dropdown */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#6D8196]" />
                        Affiliate Network / Name <span className="text-rose-500">*</span>
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
                            className="flex-1 px-3.5 py-2.5 bg-white border border-[#6D8196] rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] transition-all shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCustomAffiliate(false)}
                            className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 border border-[#CBCBCB] rounded-xl hover:bg-slate-50 cursor-pointer"
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
                      <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#6D8196]" />
                        Trend Level <span className="text-rose-500">*</span>
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
                      <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-[#6D8196]" />
                        Trend Link URL <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={form.trendLink}
                        onChange={(e) => update("trendLink", e.target.value)}
                        placeholder="https://..."
                        className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none transition-all shadow-2xs ${
                          fieldErrors.trendLink
                            ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/10"
                            : "border-[#CBCBCB] focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
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
                      <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-[#6D8196]" />
                        Preview Link URL <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={form.previewLink}
                        onChange={(e) => update("previewLink", e.target.value)}
                        placeholder="https://..."
                        className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none transition-all shadow-2xs ${
                          fieldErrors.previewLink
                            ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/10"
                            : "border-[#CBCBCB] focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
                        }`}
                      />
                      {fieldErrors.previewLink && (
                        <p className="text-xs font-semibold text-rose-500">{fieldErrors.previewLink}</p>
                      )}
                    </div>

                    {/* New Defined Category Field */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#6D8196]" />
                        Category <span className="text-rose-500">*</span>
                      </label>
                      <CustomSelect
                        value={form.category}
                        onChange={(val) => update("category", val)}
                        placeholder="Select Product Category..."
                        searchable={true}
                        searchPlaceholder="Search category..."
                        className="w-full"
                        options={categories.map((c) => ({ value: c.name, label: c.name }))}
                      />
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider">Remarks</label>
                    <textarea
                      rows={2}
                      value={form.remarks}
                      onChange={(e) => update("remarks", e.target.value)}
                      placeholder="Optional notes or instructions..."
                      className="w-full px-3.5 py-2 bg-white border border-[#CBCBCB] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196] transition-all resize-none shadow-2xs"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition text-xs shadow-2xs cursor-pointer"
                    >
                      Back to Websites
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
