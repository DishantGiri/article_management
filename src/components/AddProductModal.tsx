"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import CustomSelect from "@/components/CustomSelect";
import { generateSlug } from "@/lib/utils";
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
  ChevronLeft,
  LayoutGrid,
  ListPlus,
  ClipboardList,
  Table,
  FileSpreadsheet,
  Trash2,
  RotateCcw,
  Building2,
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
  slug: string;
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
  slug: string;
  category: string;
  trendLink: string;
  trendLevel: string;
  affiliateName: string;
  previewLink: string;
  remarks: string;
}

function StepIndicator({ step, entryMode }: { step: number; entryMode: "bulk" | "single" }) {
  if (entryMode === "bulk") {
    return (
      <div className="flex items-center justify-center max-w-lg mx-auto w-full mb-4 px-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
            ✓
          </div>
          <span className="text-slate-700 dark:text-slate-300">Product Type</span>
        </div>

        <div className="h-0.5 flex-1 mx-4 bg-blue-600/40 rounded-full" />

        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
            2
          </div>
          <span className="text-slate-800 dark:text-slate-200 font-bold">Bulk Products</span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-medium">
            Google Sheet
          </span>
        </div>
      </div>
    );
  }

  const steps = ["Product Type", "Preview Sites", "Details"];
  return (
    <div className="flex items-center gap-0 mb-6 max-w-xl mx-auto w-full px-2">
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
                    ? "bg-blue-600 text-white"
                    : active
                    ? "bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  idx
                )}
              </div>
              <span
                className={`text-[10px] font-bold tracking-tight whitespace-nowrap ${
                  active ? "text-blue-600 dark:text-blue-400" : done ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mb-4 rounded transition-all duration-500 ${
                  done ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-800"
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
  const [productCategories, setProductCategories] = useState<{ id: number; name: string }[]>([]);
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
    { name: "", slug: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" },
  ]);

  // Batch Fill Helpers
  const [batchCategory, setBatchCategory] = useState("");
  const [batchAffiliate, setBatchAffiliate] = useState("");
  const [batchTrendLevel, setBatchTrendLevel] = useState("HIGH");
  const [showSitesDrawer, setShowSitesDrawer] = useState(false);

  // Silently parses text into spreadsheet rows without showing a toast.
  // Used for onChange so every keystroke doesn't trigger a success notification.
  const updateRowsFromText = (text: string) => {
    setBulkPasteText(text);
    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .flatMap((line) => {
        if (line.includes(",") && !line.includes("http://") && !line.includes("https://")) {
          return line.split(",");
        }
        return [line];
      })
      .map((line) => line.trim().replace(/^[-*\u2022\d.)\s]+/, "").trim())
      .filter((line) => line.length > 0);

    const uniqueNames = Array.from(new Set(lines));
    if (uniqueNames.length === 0) {
      setSpreadsheetRows([{ name: "", slug: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" }]);
      return;
    }

    const newRows: SpreadsheetRow[] = uniqueNames.map((n) => ({
      name: n,
      slug: generateSlug(n),
      category: batchCategory || form.category || "",
      affiliateName: batchAffiliate || form.affiliateName || "",
      trendLevel: batchTrendLevel || form.trendLevel || "HIGH",
      trendLink: "",
      previewLink: "",
      remarks: "",
    }));

    setSpreadsheetRows(newRows);
  };

  // Full parse with success toast — only called on explicit paste/clipboard actions.
  const parseTextToRows = (text: string) => {
    setBulkPasteText(text);
    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .flatMap((line) => {
        if (line.includes(",") && !line.includes("http://") && !line.includes("https://")) {
          return line.split(",");
        }
        return [line];
      })
      .map((line) => line.trim().replace(/^[-*\u2022\d.)\s]+/, "").trim())
      .filter((line) => line.length > 0);

    const uniqueNames = Array.from(new Set(lines));
    if (uniqueNames.length === 0) return;

    const newRows: SpreadsheetRow[] = uniqueNames.map((n) => ({
      name: n,
      slug: generateSlug(n),
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
      const current = next[index];
      const updated = { ...current, [field]: value };

      // Auto-generate slug when product name is modified (unless user already customized slug)
      if (field === "name") {
        const prevAutoSlug = generateSlug(current.name);
        if (!current.slug || current.slug === prevAutoSlug) {
          updated.slug = generateSlug(value);
        }
      } else if (field === "slug") {
        updated.slug = value.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-");
      }

      next[index] = updated;
      return next;
    });
  };

  const addSpreadsheetRow = () => {
    setSpreadsheetRows((prev) => [
      ...prev,
      {
        name: "",
        slug: "",
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
        return [{ name: "", slug: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" }];
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
    slug: "",
    category: "",
    trendLink: "",
    trendLevel: "HIGH",
    affiliateName: "",
    previewLink: "",
    remarks: "",
  });

  // Track if user manually modified slug in single mode
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

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
        { name: "", slug: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" },
      ]);
      setBatchCategory("");
      setBatchAffiliate("");
      setBatchTrendLevel("HIGH");
      setShowSitesDrawer(false);
      setForm({
        categoryIds: [],
        name: "",
        slug: "",
        category: "",
        trendLink: "",
        trendLevel: "HIGH",
        affiliateName: "",
        previewLink: "",
        remarks: "",
      });
      setIsSlugManuallyEdited(false);
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
        .catch(() => setError("Failed to load initial data"))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const update = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name" && !isSlugManuallyEdited) {
        next.slug = generateSlug(value);
      }
      return next;
    });
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
        if (r.trendLink.trim() && !isValidUrl(r.trendLink)) {
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
              slug: r.slug?.trim() ? generateSlug(r.slug) : generateSlug(r.name),
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
    if (form.trendLink.trim() && !isValidUrl(form.trendLink)) {
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
          slug: form.slug?.trim() ? generateSlug(form.slug) : generateSlug(form.name),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`bg-white dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 transition-all duration-300 ${
        entryMode === "bulk" && step === 2
          ? "w-[98vw] max-w-[1550px] h-[95vh] max-h-[96vh]"
          : "w-[96vw] max-w-4xl max-h-[92vh]"
      }`}>
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Add New Product</span>
                <span className="text-slate-300 dark:text-slate-600 font-normal">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  {entryMode === "bulk" && step === 2 ? "Bulk Spreadsheet Mode" : "Product Setup"}
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className={`overflow-y-auto flex-1 flex flex-col ${entryMode === "bulk" && step === 2 ? "p-3 sm:p-4" : "p-5 sm:p-6"}`}>
          {successState ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200 dark:border-emerald-800">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                {entryMode === "bulk" ? "Products Added Successfully!" : "Product Added Successfully!"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-6">
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
                      slug: "",
                      category: "",
                      trendLink: "",
                      trendLevel: "HIGH",
                      affiliateName: "",
                      previewLink: "",
                      remarks: "",
                    });
                    setIsSlugManuallyEdited(false);
                    setSpreadsheetRows([
                      { name: "", slug: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" },
                    ]);
                    setBulkPasteText("");
                    setStep(1);
                    setSuccessState(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
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
                <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* STEP 1: Choose Product Type */}
              {step === 1 && (
                <div className="space-y-5 max-w-4xl mx-auto w-full py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Select Product Type <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Choose the product type for your products (e.g. Ecomm, Supplement)
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowAddCat(!showAddCat)}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {showAddCat ? "Cancel" : "Add Product Type"}
                      </button>
                    )}
                  </div>

                  {showAddCat && (
                    <form onSubmit={handleInlineAddCat} className="p-3.5 bg-slate-50 dark:bg-[#131d31] rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Product type name (e.g. Skin Care, Ecomm, Supplements)"
                        className="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={addingCat || !newCatName.trim()}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition cursor-pointer shadow-sm"
                      >
                        {addingCat ? "Saving..." : "Create & Select"}
                      </button>
                    </form>
                  )}

                  {loading ? (
                    <div className="text-center py-12 text-xs text-slate-400 font-medium">Loading product types...</div>
                  ) : categories.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 italic">No product types found. Click "+ Add Product Type" above.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto p-1 pr-2">
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
                            className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              selected
                                ? "bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-950 dark:text-white font-bold shadow-sm ring-1 ring-blue-500/40"
                                : "bg-slate-50 dark:bg-[#131d31] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <span className="text-xs truncate">{c.name}</span>
                            <div
                              className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${
                                selected ? "bg-blue-600 border-blue-500 text-white" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b1120]"
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
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-md shadow-blue-600/20"
                    >
                      Continue ({form.categoryIds.length} type{form.categoryIds.length !== 1 ? "s" : ""} selected) →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: BULK SPREADSHEET MODE (DEFAULT) */}
              {step === 2 && entryMode === "bulk" && (
                <div className="space-y-4">
                  {/* Mode Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          Bulk Products Spreadsheet
                        </span>
                        <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 px-2 py-0.5 rounded">
                          DEFAULT
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Selected: <strong className="text-slate-800 dark:text-slate-200">{getCategoryNames() || "Selected Type"}</strong> · Direct paste 10+ products or edit directly in the table
                      </p>
                    </div>

                    <div className="inline-flex p-1 bg-slate-100 dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl shrink-0 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setEntryMode("bulk")}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-blue-600 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Table className="w-3.5 h-3.5" />
                        Bulk Spreadsheet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntryMode("single")}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Single Product Form
                      </button>
                    </div>
                  </div>

                  {/* Control Center: Side-by-Side Direct Paste & Batch Fill Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0">
                    {/* Card 1: Direct Paste Box (6 columns) */}
                    <div className="lg:col-span-6 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 tracking-wide">
                          <ClipboardList className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          1. Direct Paste Products <span className="text-rose-500">*</span>
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
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                            Paste Clipboard
                          </button>
                          {bulkPasteText && (
                            <button
                              type="button"
                              onClick={() => {
                                setBulkPasteText("");
                                setSpreadsheetRows([{ name: "", slug: "", category: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "" }]);
                              }}
                              className="text-xs font-bold text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        rows={4}
                        value={bulkPasteText}
                        onChange={(e) => updateRowsFromText(e.target.value)}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData("text");
                          if (pasted) {
                            e.preventDefault();
                            parseTextToRows(bulkPasteText ? bulkPasteText + "\n" + pasted : pasted);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.stopPropagation();
                        }}
                        placeholder={"Paste 10+ product names (one per line)...\nExample:\nAlpha Whey Protein\nCreatine Monohydrate 500g\nPre-Workout Booster"}
                        className="w-full px-3 py-2.5 text-xs font-mono bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none leading-relaxed"
                      />

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <span>Paste from Excel, Google Sheets, or notepad</span>
                        <span>Auto-populates table</span>
                      </div>
                    </div>

                    {/* Card 2: Batch Fill & Sites Toolbar (6 columns) */}
                    <div className="lg:col-span-6 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                          Fill All Rows
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSitesDrawer(!showSitesDrawer)}
                          className="px-2.5 py-0.5 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Globe className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          {activeSites.length} Site{activeSites.length !== 1 ? "s" : ""} Included {showSitesDrawer ? "▲" : "▼"}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                        Choose values once and apply them to every row in the table at once.
                      </p>

                      <div className="space-y-2.5 my-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">CATEGORY</label>
                          <CustomSelect
                            value={batchCategory}
                            onChange={(val) => setBatchCategory(val)}
                            placeholder="Select category..."
                            searchable={true}
                            searchPlaceholder="Search category..."
                            className="w-full"
                            triggerClassName="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                            options={productCategories.map((c) => ({ value: c.name, label: c.name }))}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">AFFILIATE NETWORK</label>
                          <CustomSelect
                            value={batchAffiliate}
                            onChange={(val) => setBatchAffiliate(val)}
                            placeholder="Select network..."
                            searchable={true}
                            searchPlaceholder="Search affiliate..."
                            allowCustom={true}
                            className="w-full"
                            triggerClassName="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                            options={affiliates.map((aff) => ({ value: aff.name, label: aff.name }))}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">TREND LEVEL</label>
                          <CustomSelect
                            value={batchTrendLevel}
                            onChange={(val) => setBatchTrendLevel(val)}
                            className="w-full"
                            triggerClassName="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                            options={[
                              { value: "HIGH", label: "High Trend" },
                              { value: "MODERATE", label: "Moderate Trend" },
                              { value: "LOW", label: "Low / Stable" },
                            ]}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={applyBatchToAll}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs mt-2 cursor-pointer"
                      >
                        Apply to All Rows →
                      </button>
                    </div>
                  </div>

                  {/* Sites Exclusion / Customization Collapsible */}
                  {showSitesDrawer && (
                    <div className="p-3.5 bg-slate-100 dark:bg-[#131d31] rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-300">
                        <span>Included Websites for ({getCategoryNames()})</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Click to exclude any site from this upload</span>
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
                                  ? "bg-slate-200/70 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-800 line-through opacity-60"
                                  : "bg-white dark:bg-[#0b1120] text-slate-800 dark:text-slate-200 border-blue-500/50 font-bold shadow-xs"
                              }`}
                            >
                              <span>{site.name}</span>
                              {isExcluded ? <Plus className="w-3 h-3 text-slate-400 dark:text-slate-500" /> : <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section Divider & Title */}
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0">
                      <Table className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Product Table</span>
                    </div>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                      {spreadsheetRows.filter((r) => r.name.trim()).length} products · {activeSites.length} preview site{activeSites.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* 3. The Google Sheets Style Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-[#0b1120] flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto max-h-[50vh] overflow-y-auto flex-1">
                      <table className="w-full text-left border-collapse table-fixed min-w-[1050px]">
                        <thead className="bg-slate-100 dark:bg-[#162033] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                          <tr>
                            <th className="w-10 py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800/80">#</th>
                            <th className="w-[18%] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Product Name <span className="text-rose-500">*</span></th>
                            <th className="w-[14%] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Slug <span className="text-slate-400 dark:text-slate-500 text-[9px] font-normal lowercase">(auto)</span></th>
                            <th className="w-[11%] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Category <span className="text-rose-500">*</span></th>
                            <th className="w-[14%] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Affiliate Network <span className="text-rose-500">*</span></th>
                            <th className="w-[10%] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Trend <span className="text-rose-500">*</span></th>
                            <th className="w-[13%] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Trend Link</th>
                            <th className="w-[13%] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Preview Link <span className="text-rose-500">*</span></th>
                            <th className="w-[10%] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Notes</th>
                            <th className="w-10 py-2.5 px-1 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                          {spreadsheetRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                              <td className="py-1 px-2 text-center text-slate-400 dark:text-slate-500 font-bold bg-slate-50 dark:bg-slate-900/40 border-r border-slate-200 dark:border-slate-800/60">
                                {idx + 1}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-800/60">
                                <input
                                  type="text"
                                  value={row.name}
                                  onChange={(e) => updateSpreadsheetRow(idx, "name", e.target.value)}
                                  placeholder={`Product name *`}
                                  className="w-full px-2 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238] rounded-lg focus:outline-none"
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-800/60">
                                <input
                                  type="text"
                                  value={row.slug}
                                  onChange={(e) => updateSpreadsheetRow(idx, "slug", e.target.value)}
                                  placeholder="auto-slug"
                                  className="w-full px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238] rounded-lg focus:outline-none"
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-800/60 min-w-[140px]">
                                <CustomSelect
                                  value={row.category}
                                  onChange={(val) => updateSpreadsheetRow(idx, "category", val)}
                                  placeholder="Category *"
                                  searchable={true}
                                  searchPlaceholder="Search category..."
                                  portal={true}
                                  className="w-full"
                                  triggerClassName="w-full px-2 py-1.5 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                                  options={productCategories.map((c) => ({ value: c.name, label: c.name }))}
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-800/60">
                                <CustomSelect
                                  value={row.affiliateName}
                                  onChange={(val) => updateSpreadsheetRow(idx, "affiliateName", val)}
                                  placeholder="Affiliate *"
                                  searchable={true}
                                  searchPlaceholder="Search affiliate..."
                                  allowCustom={true}
                                  portal={true}
                                  minWidth={200}
                                  className="w-full"
                                  triggerClassName="w-full px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-lg"
                                  options={affiliates.map((aff) => ({ value: aff.name, label: aff.name }))}
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-800/60">
                                <CustomSelect
                                  value={row.trendLevel}
                                  onChange={(val) => updateSpreadsheetRow(idx, "trendLevel", val)}
                                  portal={true}
                                  minWidth={120}
                                  className="w-full"
                                  triggerClassName="w-full px-2 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-lg"
                                  options={[
                                    { value: "HIGH", label: "High" },
                                    { value: "MODERATE", label: "Moderate" },
                                    { value: "LOW", label: "Low" },
                                  ]}
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-800/60">
                                <input
                                  type="url"
                                  value={row.trendLink}
                                  onChange={(e) => updateSpreadsheetRow(idx, "trendLink", e.target.value)}
                                  placeholder="https://... (optional)"
                                  className="w-full px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238] rounded-lg focus:outline-none"
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-800/60">
                                <input
                                  type="url"
                                  value={row.previewLink}
                                  onChange={(e) => updateSpreadsheetRow(idx, "previewLink", e.target.value)}
                                  placeholder="https://... *"
                                  className="w-full px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238] rounded-lg focus:outline-none"
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-800/60">
                                <input
                                  type="text"
                                  value={row.remarks}
                                  onChange={(e) => updateSpreadsheetRow(idx, "remarks", e.target.value)}
                                  placeholder="Notes..."
                                  className="w-full px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238] rounded-lg focus:outline-none"
                                />
                              </td>
                              <td className="py-1 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeSpreadsheetRow(idx)}
                                  className="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition cursor-pointer mx-auto"
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

                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#131d31] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={addSpreadsheetRow}
                        className="font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer bg-white dark:bg-[#0b1120] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Blank Row
                      </button>

                      <div className="text-slate-500 dark:text-slate-400 font-medium">
                        {spreadsheetRows.length} row{spreadsheetRows.length !== 1 ? "s" : ""} in table
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131d31] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back to Product Type
                    </button>
                    <button
                      type="button"
                      disabled={spreadsheetRows.filter((r) => r.name.trim()).length === 0 || submitting}
                      onClick={handleSubmit}
                      className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
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
                <div className="space-y-4 max-w-4xl mx-auto w-full">
                  {/* Mode Switcher */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider">
                        Product Entry Mode
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Switch to Bulk Spreadsheet or continue with Single Product Form
                      </p>
                    </div>

                    <div className="inline-flex p-1 bg-slate-100 dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setEntryMode("bulk")}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer flex items-center gap-1.5"
                      >
                        <Table className="w-3.5 h-3.5" />
                        Bulk Spreadsheet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntryMode("single")}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-blue-600 text-white shadow-sm cursor-pointer"
                      >
                        Single Product Form
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Associated Websites ({getCategoryNames()})
                    </label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowAddSite(!showAddSite)}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {showAddSite ? "Cancel" : "Add Website"}
                      </button>
                    )}
                  </div>

                  {showAddSite && (
                    <form onSubmit={handleInlineAddSite} className="p-3.5 bg-slate-50 dark:bg-[#131d31] rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <input
                        type="text"
                        value={newSiteName}
                        onChange={(e) => setNewSiteName(e.target.value)}
                        placeholder="Site Name (e.g. Health Daily)"
                        className="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="url"
                        value={newSiteUrl}
                        onChange={(e) => setNewSiteUrl(e.target.value)}
                        placeholder="Site URL (https://...)"
                        className="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={addingSite || !newSiteName.trim()}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition cursor-pointer shadow-sm"
                      >
                        {addingSite ? "Saving..." : "Create & Link"}
                      </button>
                    </form>
                  )}

                  {previewSites.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 italic">
                      No websites found for selected categories. Click "+ Add Website" above to configure one.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto p-1 pr-2">
                      {previewSites.map((site: any) => {
                        const isExcluded = excludedSiteIds.includes(site.id);
                        return (
                          <div
                            key={site.id}
                            className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all ${
                              isExcluded
                                ? "bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-60"
                                : "bg-white dark:bg-[#131d31] border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold truncate">{site.name}</span>
                              {site.url && (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate hidden sm:inline">
                                  ({site.url})
                                </span>
                              )}
                              {isExcluded ? (
                                <span className="text-[10px] bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 px-2 py-0.5 rounded-md font-bold shrink-0">
                                  Excluded
                                </span>
                              ) : (
                                <span className="text-[10px] bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 px-2 py-0.5 rounded-md font-bold shrink-0">
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
                              className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 shrink-0 ${
                                isExcluded
                                  ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-600/10"
                                  : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                              }`}
                              title={isExcluded ? "Re-include this site" : "Remove/Deselect this site"}
                            >
                              {isExcluded ? (
                                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">Re-include</span>
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
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131d31] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={activeSites.length === 0}
                      onClick={() => setStep(3)}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs disabled:opacity-40 transition cursor-pointer shadow-md shadow-blue-600/20"
                    >
                      Continue ({activeSites.length} site{activeSites.length !== 1 ? "s" : ""})
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: DETAILS (IF IN SINGLE MODE) */}
              {step === 3 && entryMode === "single" && (
                <div className="space-y-4 max-w-4xl mx-auto w-full">
                  {/* Grid 2-Column: Product Name & Slug */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Product Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Product Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="e.g. Alpha Whey Protein"
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all shadow-xs"
                      />
                    </div>

                    {/* Product Slug (Auto-generated & Editable) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          Product Slug <span className="text-slate-400 font-normal text-[10px] normal-case">(Auto-generated)</span>
                        </label>
                        {isSlugManuallyEdited && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsSlugManuallyEdited(false);
                              setForm((prev) => ({ ...prev, slug: generateSlug(prev.name) }));
                            }}
                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                            title="Reset to auto-generated slug"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Reset to Auto</span>
                          </button>
                        )}
                      </div>
                      <input
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
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Grid 2-Column: Category & Affiliate Network */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Category <span className="text-rose-500">*</span>
                      </label>
                      <CustomSelect
                        value={form.category}
                        onChange={(val) => update("category", val)}
                        placeholder="Select Product Category..."
                        searchable={true}
                        searchPlaceholder="Search category..."
                        className="w-full"
                        triggerClassName="w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                        options={productCategories.map((c) => ({ value: c.name, label: c.name }))}
                      />
                    </div>

                    {/* Affiliate Network Dropdown */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
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
                          triggerClassName="w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
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
                            className="flex-1 px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCustomAffiliate(false)}
                            className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Trend Level <span className="text-rose-500">*</span>
                      </label>
                      <CustomSelect
                        value={form.trendLevel}
                        onChange={(val) => update("trendLevel", val)}
                        placeholder="Select Trend Level..."
                        triggerClassName="w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                        options={[
                          { value: "HIGH", label: "High Trend" },
                          { value: "MODERATE", label: "Moderate Trend" },
                          { value: "LOW", label: "Low / Stable" },
                        ]}
                      />
                    </div>

                    {/* Trend Link */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Trend Link URL <span className="text-slate-400 font-normal text-[10px] normal-case">(Optional)</span>
                      </label>
                      <input
                        type="url"
                        value={form.trendLink}
                        onChange={(e) => update("trendLink", e.target.value)}
                        placeholder="https://... (optional)"
                        className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all shadow-xs ${
                          fieldErrors.trendLink
                            ? "border-rose-500/60 focus:ring-1 focus:ring-rose-500"
                            : "border-slate-200 dark:border-slate-800 focus:border-blue-500"
                        }`}
                      />
                      {fieldErrors.trendLink && (
                        <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">{fieldErrors.trendLink}</p>
                      )}
                    </div>
                  </div>

                  {/* Grid 2-Column: Preview Link & Remarks */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Preview Link */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Preview Link URL <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={form.previewLink}
                        onChange={(e) => update("previewLink", e.target.value)}
                        placeholder="https://..."
                        className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all shadow-xs ${
                          fieldErrors.previewLink
                            ? "border-rose-500/60 focus:ring-1 focus:ring-rose-500"
                            : "border-slate-200 dark:border-slate-800 focus:border-blue-500"
                        }`}
                      />
                      {fieldErrors.previewLink && (
                        <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">{fieldErrors.previewLink}</p>
                      )}
                    </div>

                    {/* Remarks */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Remarks</label>
                      <input
                        type="text"
                        value={form.remarks}
                        onChange={(e) => update("remarks", e.target.value)}
                        placeholder="Optional notes or instructions..."
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all shadow-xs"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131d31] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back to Websites
                    </button>
                    <button
                      type="button"
                      disabled={!form.name.trim() || submitting}
                      onClick={handleSubmit}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs shadow-lg shadow-blue-600/20 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-2"
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
