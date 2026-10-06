"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { getActiveWorkspace } from "@/lib/workspace";
import { toast } from "react-hot-toast";
import CustomSelect from "@/components/CustomSelect";
import AffiliateMultiSelect from "@/components/AffiliateMultiSelect";
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
  ChevronUp,
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

import { getCountryFlag, TIER1_CODES, LATAM_COUNTRIES, COUNTRY_NAMES } from "@/lib/geo-constants";

interface Site {
  id: number;
  name: string;
  allowCountrySpecific?: boolean;
}

interface Category {
  id: number;
  name: string;
}

interface Affiliate {
  id: number;
  name: string;
}

export const PRODUCT_SOURCE_OPTIONS = [
  { value: "Affiliate", label: "Affiliate" },
  { value: "Competitor", label: "Competitor" },
  { value: "Social Media/Native", label: "Social Media/Native" },
  { value: "Source", label: "Source" },
];

export interface SpreadsheetRow {
  name: string;
  slug: string;
  country?: string;
  category: string;
  source?: string;
  affiliateName: string;
  trendLevel: string;
  trendLink: string;
  previewLink: string;
  remarks: string;
  isNative?: boolean;
}

interface FormData {
  categoryIds: number[];
  name: string;
  slug: string;
  country?: string;
  category: string;
  source: string;
  trendLink: string;
  trendLevel: string;
  affiliateName: string;
  previewLink: string;
  remarks: string;
  isNative: boolean;
}

function StepIndicator({ step, entryMode }: { step: number; entryMode: "bulk" | "single" }) {
  if (entryMode === "bulk") {
    return (
      <div className="flex items-center justify-center max-w-lg mx-auto w-full mb-4 px-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 shrink-0">
          <div className="w-5 h-5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center text-[10px] font-bold shadow-xs">
            <Check className="w-3 h-3" />
          </div>
          <span className="text-zinc-700 dark:text-zinc-300">Product Type</span>
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
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${done
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
                className={`text-[10px] font-bold tracking-tight whitespace-nowrap ${active ? "text-blue-600 dark:text-blue-400" : done ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"
                  }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mb-4 rounded transition-all duration-500 ${done ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-800"
                  }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface InitialProductData {
  name?: string;
  slug?: string;
  category?: string;
  source?: string;
  trendLink?: string;
  previewLink?: string;
  trendLevel?: string;
  remarks?: string;
  country?: string;
  isNative?: boolean;
  defaultEntryMode?: "single" | "bulk";
  trendmapProductId?: number;
}

export default function AddProductModal({
  isOpen,
  onClose,
  onSuccess,
  isProductResearch: isProductResearchProp,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdProduct?: any) => void;
  isProductResearch?: boolean;
  initialData?: InitialProductData | null;
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
  const [batchSource, setBatchSource] = useState("");
  const [batchAffiliate, setBatchAffiliate] = useState("");
  const [batchTrendLevel, setBatchTrendLevel] = useState("");
  const [batchIsNative, setBatchIsNative] = useState("");
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
      setSpreadsheetRows([{ name: "", slug: "", category: "", source: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "", isNative: false }]);
      return;
    }

    const newRows: SpreadsheetRow[] = uniqueNames.map((n) => ({
      name: n,
      slug: generateSlug(n),
      category: batchCategory || form.category || "",
      source: batchSource || form.source || "",
      affiliateName: batchAffiliate || form.affiliateName || "",
      trendLevel: batchTrendLevel || form.trendLevel || "HIGH",
      isNative: batchIsNative ? batchIsNative === "true" : (form.isNative ?? false),
      trendLink: "",
      previewLink: "",
      remarks: "",
    }));

    setSpreadsheetRows(newRows);
  };

  // Full parse with success toast - only called on explicit paste/clipboard actions.
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
      source: batchSource || form.source || "",
      affiliateName: batchAffiliate || form.affiliateName || "",
      trendLevel: batchTrendLevel || form.trendLevel || "HIGH",
      isNative: batchIsNative ? batchIsNative === "true" : (form.isNative ?? false),
      trendLink: "",
      previewLink: "",
      remarks: "",
    }));

    setSpreadsheetRows(newRows);
    toast.success(`Imported ${newRows.length} products into spreadsheet table!`);
  };

  const updateSpreadsheetRow = (index: number, field: keyof SpreadsheetRow, value: any) => {
    setSpreadsheetRows((prev) => {
      const next = [...prev];
      const current = next[index];
      const updated = { ...current, [field]: value };

      // Auto-generate slug when product name is modified (unless user already customized slug)
      if (field === "name" && typeof value === "string") {
        const prevAutoSlug = generateSlug(current.name);
        if (!current.slug || current.slug === prevAutoSlug) {
          updated.slug = generateSlug(value);
        }
      } else if (field === "slug" && typeof value === "string") {
        updated.slug = value.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-");
      }

      next[index] = updated;
      return next;
    });

    // Clear inline cell error on change
    setCellErrors((prev) => {
      if (!prev[index] || !prev[index][field as keyof typeof prev[number]]) return prev;
      const copy = { ...prev };
      const rowErr = { ...copy[index] };
      delete (rowErr as any)[field];
      if (Object.keys(rowErr).length === 0) {
        delete copy[index];
      } else {
        copy[index] = rowErr;
      }
      return copy;
    });
  };

  const addSpreadsheetRow = () => {
    setSpreadsheetRows((prev) => [
      ...prev,
      {
        name: "",
        slug: "",
        category: batchCategory || form.category || "",
        source: batchSource || form.source || "",
        affiliateName: batchAffiliate || form.affiliateName || "",
        trendLevel: batchTrendLevel || "HIGH",
        isNative: batchIsNative ? batchIsNative === "true" : (form.isNative ?? false),
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
        return [{ name: "", slug: "", category: "", source: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "", isNative: false }];
      }
      return next;
    });
    setCellErrors({});
  };

  const applyBatchToAll = () => {
    if (!batchCategory && !batchSource && !batchAffiliate && !batchTrendLevel && !batchIsNative) {
      toast.error("Please select at least one field to apply to all rows.");
      return;
    }

    if (spreadsheetRows.length === 0) {
      toast.error("No spreadsheet rows to apply values to.");
      return;
    }

    setSpreadsheetRows((prev) =>
      prev.map((row) => ({
        ...row,
        category: batchCategory ? batchCategory : row.category,
        source: batchSource ? batchSource : row.source,
        affiliateName: batchAffiliate ? batchAffiliate : row.affiliateName,
        trendLevel: batchTrendLevel ? batchTrendLevel : row.trendLevel,
        isNative: batchIsNative ? batchIsNative === "true" : row.isNative,
      }))
    );
    toast.success("Applied batch values to all spreadsheet rows!");
  };

  const [form, setForm] = useState<FormData>({
    categoryIds: [],
    name: "",
    slug: "",
    country: "",
    category: "",
    source: "",
    trendLink: "",
    trendLevel: "HIGH",
    affiliateName: "",
    previewLink: "",
    remarks: "",
    isNative: false,
  });

  // Track if user manually modified slug in single mode
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  // User role & workspace detection
  const userRole = (session?.user?.role || "").toUpperCase();
  const sessionRoles = useMemo(() => {
    const raw: string[] = (session?.user as any)?.roles || [];
    return Array.from(new Set([...raw, userRole].filter(Boolean).map((r) => r.toUpperCase())));
  }, [session?.user, userRole]);

  const activeWorkspace = typeof window !== "undefined"
    ? (localStorage.getItem("active_workspace_role")?.toUpperCase() || getActiveWorkspace(userRole, sessionRoles))
    : getActiveWorkspace(userRole, sessionRoles);

  const isProductResearcherRole =
    Boolean(isProductResearchProp) ||
    activeWorkspace === "PRODUCT_RESEARCHER" ||
    userRole === "PRODUCT_RESEARCHER" ||
    sessionRoles.includes("PRODUCT_RESEARCHER");

  const [distributeToAllSites, setDistributeToAllSites] = useState<boolean>(false);
  const [selectedSingleSiteId, setSelectedSingleSiteId] = useState<number | null>(null);

  // Deselected/excluded sites state
  const [excludedSiteIds, setExcludedSiteIds] = useState<number[]>([]);

  // Real-time Database Duplicate Check States
  const [singleCheckStatus, setSingleCheckStatus] = useState<{
    checking: boolean;
    exists?: boolean;
    isUncertain?: boolean;
    message?: string;
    conflicts?: Array<{ siteName: string; addedBy: string; country?: string | null }>;
  }>({ checking: false });

  const [bulkCheckResults, setBulkCheckResults] = useState<
    Record<
      number,
      {
        checking?: boolean;
        exists?: boolean;
        isUncertain?: boolean;
        message?: string;
        conflicts?: Array<{ siteName: string; addedBy: string; country?: string | null }>;
      }
    >
  >({});
  const [isBulkChecking, setIsBulkChecking] = useState(false);

  // Inline cell errors for spreadsheet rows (no toasts for missing fields)
  const [cellErrors, setCellErrors] = useState<
    Record<
      number,
      {
        name?: string;
        category?: string;
        affiliateName?: string;
        trendLevel?: string;
        trendLink?: string;
        previewLink?: string;
      }
    >
  >({});

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
    const trimmed = newCatName.trim().replace(/\s+/g, " ");
    if (!trimmed) return;

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      setError("Special characters are not allowed. Only letters, numbers, and spaces are permitted for product type names.");
      toast.error("Special characters are not allowed. Only letters, numbers, and spaces are permitted.", { id: "cat-char-error" });
      return;
    }

    setAddingCat(true);
    setError("");
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
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
    const trimmed = newSiteName.trim().replace(/\s+/g, " ");
    if (!trimmed) return;

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      setError("Special characters are not allowed. Only letters, numbers, and spaces are permitted for site names.");
      toast.error("Special characters are not allowed. Only letters, numbers, and spaces are permitted.", { id: "site-char-error" });
      return;
    }

    setAddingSite(true);
    setError("");
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
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
      setError("");                          // ← clear stale errors
      setBulkCheckResults({});              // ← clear stale duplicate warnings
      setSingleCheckStatus({ checking: false }); // ← clear stale check status
      setFieldErrors({});                   // ← clear stale field errors
      setCellErrors({});                    // ← clear stale cell errors
      setShowAddCat(false);
      setShowAddSite(false);
      setShowCustomAffiliate(false);
      if (isProductResearcherRole) {
        setExcludedSiteIds(sites.map((s: any) => s.id));
      } else {
        setExcludedSiteIds([]);
      }
      setEntryMode(initialData?.defaultEntryMode || (initialData?.name ? "single" : "bulk"));
      setBulkPasteText("");
      setSpreadsheetRows([
        { name: initialData?.name || "", slug: initialData?.slug || (initialData?.name ? generateSlug(initialData.name) : ""), category: initialData?.category || "", affiliateName: "", trendLevel: initialData?.trendLevel || "HIGH", trendLink: initialData?.trendLink || "", previewLink: initialData?.previewLink || "", remarks: initialData?.remarks || "", isNative: initialData?.isNative ?? false },
      ]);
      setBatchCategory(initialData?.category || "");
      setBatchSource(initialData?.source || "");
      setBatchAffiliate("");
      setBatchTrendLevel(initialData?.trendLevel || "");
      setBatchIsNative("");
      setShowSitesDrawer(false);
      setForm({
        categoryIds: [],
        name: initialData?.name || "",
        slug: initialData?.slug || (initialData?.name ? generateSlug(initialData.name) : ""),
        country: initialData?.country || "",
        category: initialData?.category || "",
        source: initialData?.source || "Competitor",
        trendLink: initialData?.trendLink || "",
        trendLevel: initialData?.trendLevel || "HIGH",
        affiliateName: "",
        previewLink: initialData?.previewLink || "",
        remarks: initialData?.remarks || "",
        isNative: initialData?.isNative ?? false,
      });
      setIsSlugManuallyEdited(Boolean(initialData?.slug));
      setLoading(true);
      Promise.all([
        fetch("/api/categories").then((r) => r.json()),
        fetch("/api/product-categories").then((r) => r.json()),
        fetch("/api/sites").then((r) => r.json()),
        fetch("/api/affiliates").then((r) => r.json()),
      ])
        .then(([catsData, prodCatsData, sitesData, affsData]) => {
          const rawCats = Array.isArray(catsData) ? catsData : [];
          setCategories(rawCats);
          setProductCategories(Array.isArray(prodCatsData) ? prodCatsData : []);
          const rawSites = Array.isArray(sitesData) ? sitesData : [];
          setSites(rawSites);
          setAffiliates(Array.isArray(affsData) ? affsData : []);
          if (isProductResearcherRole) {
            setExcludedSiteIds(rawSites.map((s: any) => s.id));
          } else {
            setExcludedSiteIds([]);
          }

          if (initialData?.category) {
            const matchedCat = rawCats.find(
              (c: any) => c.name.toLowerCase() === initialData.category?.toLowerCase()
            );
            if (matchedCat) {
              setForm((prev) => ({
                ...prev,
                categoryIds: [matchedCat.id],
                category: matchedCat.name,
              }));
            }
          }
        })
        .catch(() => setError("Failed to load initial data"))
        .finally(() => setLoading(false));
    }
  }, [isOpen, isProductResearcherRole, initialData]);

  // Real-time database check for Single Product mode
  useEffect(() => {
    if (!isOpen || entryMode !== "single" || step !== 3) return;
    const trimmedName = form.name.trim();
    if (trimmedName.length < 2) {
      setSingleCheckStatus({ checking: false });
      return;
    }

    setSingleCheckStatus({ checking: true });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/products/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ name: trimmedName, country: form.country, key: "single" }],
            categoryIds: form.categoryIds,
            excludedSiteIds,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const result = data.results?.["single"];
          if (result) {
            setSingleCheckStatus({
              checking: false,
              exists: result.exists,
              isUncertain: result.isUncertain,
              message: result.message,
              conflicts: result.conflicts,
            });
            return;
          }
        }
        setSingleCheckStatus({ checking: false });
      } catch (err) {
        console.error("Single product check failed:", err);
        setSingleCheckStatus({ checking: false });
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [isOpen, entryMode, step, form.name, form.country, form.categoryIds, excludedSiteIds]);

  // Real-time database check for Bulk Spreadsheet mode
  useEffect(() => {
    if (!isOpen || entryMode !== "bulk" || step !== 2) return;

    const itemsToCheck: Array<{ name: string; country?: string | null; key: string }> = [];
    const internalDuplicates: Record<number, { exists: boolean; message: string }> = {};

    // Check duplicate rows inside the table itself
    const seenMap = new Map<string, number>();

    spreadsheetRows.forEach((row, idx) => {
      const trimmed = row.name.trim();
      if (trimmed.length >= 2) {
        const key = `${trimmed.toLowerCase()}_${(row.country || "").toUpperCase()}`;
        if (seenMap.has(key)) {
          const firstIdx = seenMap.get(key)!;
          internalDuplicates[idx] = {
            exists: true,
            message: `Duplicate in row #${firstIdx + 1}`,
          };
        } else {
          seenMap.set(key, idx);
          itemsToCheck.push({
            name: trimmed,
            country: row.country,
            key: String(idx),
          });
        }
      }
    });

    if (itemsToCheck.length === 0 && Object.keys(internalDuplicates).length === 0) {
      setBulkCheckResults({});
      setIsBulkChecking(false);
      return;
    }

    setIsBulkChecking(true);
    const timer = setTimeout(async () => {
      try {
        let dbResults: Record<string, any> = {};
        if (itemsToCheck.length > 0) {
          const res = await fetch("/api/products/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: itemsToCheck,
              categoryIds: form.categoryIds,
              excludedSiteIds,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            dbResults = data.results || {};
          }
        }

        const newResults: Record<number, any> = {};
        spreadsheetRows.forEach((row, idx) => {
          if (row.name.trim().length < 2) return;

          if (internalDuplicates[idx]) {
            newResults[idx] = {
              checking: false,
              exists: true,
              isUncertain: false,
              message: internalDuplicates[idx].message,
            };
          } else if (dbResults[String(idx)]) {
            newResults[idx] = {
              checking: false,
              exists: dbResults[String(idx)].exists,
              isUncertain: dbResults[String(idx)].isUncertain,
              message: dbResults[String(idx)].message,
              conflicts: dbResults[String(idx)].conflicts,
            };
          }
        });

        setBulkCheckResults(newResults);
      } catch (err) {
        console.error("Bulk check failed:", err);
      } finally {
        setIsBulkChecking(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [isOpen, entryMode, step, spreadsheetRows, form.categoryIds, excludedSiteIds]);

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
    } else {
      setFieldErrors((prevErrors) => {
        if (!prevErrors[field]) return prevErrors;
        const next = { ...prevErrors };
        delete next[field];
        return next;
      });
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
    if (entryMode === "bulk") {
      const validRows = spreadsheetRows.filter((r) => r.name.trim().length > 0);
      if (validRows.length === 0) {
        setError("Please enter or paste at least one product name in the spreadsheet table.");
        toast.error("Please enter or paste at least one product name in the spreadsheet table.");
        return;
      }

      // 1. Block exact duplicate rows!
      const hasExactDuplicate = spreadsheetRows.some(
        (r, idx) => r.name.trim().length >= 2 && bulkCheckResults[idx]?.exists
      );
      if (hasExactDuplicate) {
        // Block the add until the duplicate is removed or renamed
        return;
      }

      // 2. A "may already exist" warning is used only for uncertain matches, and then the add can continue.
      const uncertainCount = spreadsheetRows.filter(
        (r, idx) => r.name.trim().length >= 2 && bulkCheckResults[idx]?.isUncertain
      ).length;
      if (uncertainCount > 0) {
        toast(`Warning: ${uncertainCount} product(s) may already exist on target sites. Proceeding anyway — the server will confirm.`, {
          icon: undefined,
          style: { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" },
          duration: 4000,
        });
      }

      // 3. Show missing-field errors inline on the cells instead of as separate toasts
      const newCellErrors: Record<
        number,
        {
          name?: string;
          category?: string;
          affiliateName?: string;
          trendLevel?: string;
          trendLink?: string;
          previewLink?: string;
        }
      > = {};

      let hasFieldErrors = false;

      validRows.forEach((r) => {
        const originalIdx = spreadsheetRows.indexOf(r);
        // If row is a duplicate, do not validate missing fields (only show duplicate notification)
        if (bulkCheckResults[originalIdx]?.exists) return;

        const rowErr: Record<string, string> = {};
        if (r.name.trim().length < 2) {
          rowErr.name = "Min 2 characters required";
          hasFieldErrors = true;
        }
        if (!r.category.trim()) {
          rowErr.category = "Category is compulsory";
          hasFieldErrors = true;
        }
        if (!r.affiliateName.trim()) {
          rowErr.affiliateName = "Affiliate is compulsory";
          hasFieldErrors = true;
        }
        if (!r.trendLevel || !r.trendLevel.trim()) {
          rowErr.trendLevel = "Trend Level is compulsory";
          hasFieldErrors = true;
        }
        if (r.trendLink.trim() && !isValidUrl(r.trendLink)) {
          rowErr.trendLink = "Must be a valid URL starting with http:// or https://";
          hasFieldErrors = true;
        }
        if (r.previewLink.trim() && !isValidUrl(r.previewLink)) {
          rowErr.previewLink = "Must be a valid URL starting with http:// or https://";
          hasFieldErrors = true;
        }

        if (Object.keys(rowErr).length > 0) {
          newCellErrors[originalIdx] = rowErr;
        }
      });

      setCellErrors(newCellErrors);

      if (hasFieldErrors) {
        // Inline errors on cells shown directly; no separate toasts
        return;
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
              country: r.country?.trim() || null,
              isNative: Boolean(r.isNative),
              productCategory: r.category.trim(),
              source: r.source?.trim() || null,
              affiliateName: r.affiliateName.trim(),
              trendLevel: r.trendLevel || "HIGH",
              trendLink: r.trendLink.trim(),
              previewLink: r.previewLink.trim(),
              remarks: r.remarks.trim() || null,
            })),
            categoryIds: form.categoryIds,
            excludedSiteIds,
            targetSiteIds: activeSites.map((s: any) => s.id),
            targetSiteNames: activeSites.map((s: any) => s.name),
            singleSiteId: isProductResearcherRole
              ? null
              : distributeToAllSites
              ? null
              : (selectedSingleSiteId || (activeSites[0]?.id ?? null)),
            distributeToAllSites,
            addedById: session?.user?.id || 1,
            isProductResearch: isProductResearcherRole,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create products");
        }

        const resData = await res.json().catch(() => null);

        if (initialData?.trendmapProductId) {
          fetch(`/api/trendmap-products/${initialData.trendmapProductId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              addedToCatalog: true,
              status: "ADDED",
            }),
          }).catch((e) => console.error("Failed to link Trendmap product:", e));
        }

        toast.success(`Successfully created ${validRows.length} products!`);
        setSuccessState(true);
        if (onSuccess) onSuccess(resData);
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
    // 1. Block exact duplicate
    if (singleCheckStatus.exists) {
      return;
    }

    // 2. A "may already exist" warning is used only for uncertain matches, and then the add can continue.
    if (singleCheckStatus.isUncertain) {
      toast(`Warning: ${singleCheckStatus.message}. Proceeding — the server will confirm.`, {
        style: { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" },
        duration: 4000,
      });
    }

    const errors: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      errors.name = !form.name.trim() ? "Product Name is compulsory." : "Product name must be at least 2 characters.";
    }
    if (!form.category.trim()) {
      errors.category = "Category is compulsory.";
    }
    const finalAffiliate = form.affiliateName.trim();
    if (!finalAffiliate) {
      errors.affiliateName = "Affiliate Network is compulsory.";
    }
    if (!form.trendLevel || !form.trendLevel.trim()) {
      errors.trendLevel = "Trend Level is compulsory.";
    }
    if (form.trendLink.trim() && !isValidUrl(form.trendLink)) {
      errors.trendLink = "Trend Link must start with http:// or https:// and be a valid URL.";
    }
    if (form.previewLink.trim() && !isValidUrl(form.previewLink)) {
      errors.previewLink = "Preview Link must start with http:// or https:// and be a valid URL.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
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
          country: form.country?.trim() || null,
          categoryIds: form.categoryIds,
          excludedSiteIds,
          targetSiteIds: activeSites.map((s: any) => s.id),
          targetSiteNames: activeSites.map((s: any) => s.name),
          singleSiteId: isProductResearcherRole
            ? null
            : distributeToAllSites
            ? null
            : (selectedSingleSiteId || (activeSites[0]?.id ?? null)),
          distributeToAllSites,
          isNative: Boolean(form.isNative),
          productCategory: form.category.trim() || null,
          source: form.source?.trim() || null,
          trendLink: form.trendLink || null,
          trendLevel: form.trendLevel || "HIGH",
          affiliateName: finalAffiliate || null,
          previewLink: form.previewLink.trim() || null,
          remarks: form.remarks || null,
          addedById: session?.user?.id || 1,
          isProductResearch: isProductResearcherRole,
        }),
      });

      const resData = await res.json().catch(() => null);

      if (initialData?.trendmapProductId) {
        const createdProdId = resData?.products?.[0]?.id || null;
        fetch(`/api/trendmap-products/${initialData.trendmapProductId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addedToCatalog: true,
            status: "ADDED",
            catalogProductId: createdProdId,
          }),
        }).catch((e) => console.error("Failed to link Trendmap product:", e));
      }

      toast.success("Successfully added product!");
      setSuccessState(true);
      if (onSuccess) onSuccess(resData);
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
  const hasCountrySpecificSite = activeSites.some((site: any) => Boolean(site.allowCountrySpecific));

  const canAddProduct =
    userRole === "SUPER_ADMIN" ||
    userRole === "ADMIN" ||
    userRole === "LINKER" ||
    userRole === "PRODUCT_RESEARCHER" ||
    activeWorkspace === "LINKER" ||
    activeWorkspace === "ADMIN" ||
    activeWorkspace === "SUPER_ADMIN" ||
    activeWorkspace === "PRODUCT_RESEARCHER" ||
    sessionRoles.includes("LINKER") ||
    sessionRoles.includes("ADMIN") ||
    sessionRoles.includes("SUPER_ADMIN") ||
    sessionRoles.includes("PRODUCT_RESEARCHER");

  if (!isOpen || !canAddProduct) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`bg-white dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 transition-all duration-300 ${entryMode === "bulk" && step === 2
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
                      country: "",
                      category: "",
                      source: "",
                      trendLink: "",
                      trendLevel: "HIGH",
                      affiliateName: "",
                      previewLink: "",
                      remarks: "",
                      isNative: false,
                    });
                    setIsSlugManuallyEdited(false);
                    setSpreadsheetRows([
                      { name: "", slug: "", category: "", source: "", affiliateName: "", trendLevel: "HIGH", trendLink: "", previewLink: "", remarks: "", isNative: false },
                    ]);
                    setBatchCategory("");
                    setBatchSource("");
                    setBatchAffiliate("");
                    setBatchTrendLevel("");
                    setBatchIsNative("");
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
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/[^a-zA-Z0-9 ]/.test(val)) {
                            toast.error("Special characters are not allowed. Only letters, numbers, and spaces are permitted.", { id: "cat-char-error" });
                          }
                          setNewCatName(val.replace(/[^a-zA-Z0-9 ]/g, ""));
                        }}
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
                            className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${selected
                              ? "bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-950 dark:text-white font-bold shadow-sm ring-1 ring-blue-500/40"
                              : "bg-slate-50 dark:bg-[#131d31] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                              }`}
                          >
                            <span className="text-xs truncate">{c.name}</span>
                            <div
                              className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${selected ? "bg-blue-600 border-blue-500 text-white" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b1120]"
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
                      onClick={() => {
                        const matchingSites = sites.filter((site: any) =>
                          site.categories?.some((c: any) => form.categoryIds.includes(c.id))
                        );
                        if (isProductResearcherRole) {
                          setExcludedSiteIds(matchingSites.map((s: any) => s.id));
                        } else {
                          setExcludedSiteIds([]);
                        }
                        setStep(2);
                      }}
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

                  {/* Control Center: Side-by-Side Direct Paste & Batch Fill */}
                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    {/* LEFT — Direct Paste Box */}
                    <div className="bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col shadow-xs">
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
                        rows={8}
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
                        className="w-full flex-1 px-3 py-2.5 text-xs font-mono bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none leading-relaxed"
                      />

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <span>Paste from Excel, Google Sheets, or notepad</span>
                        <span>Auto-populates table</span>
                      </div>
                    </div>

                    {/* RIGHT — Fill All Rows */}
                    <div className="bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col shadow-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                          Fill All Rows
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSitesDrawer(!showSitesDrawer)}
                          className="px-2.5 py-0.5 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Globe className="w-3 h-3 text-zinc-900 dark:text-zinc-100" />
                          <span>{activeSites.length} Site{activeSites.length !== 1 ? "s" : ""} Included</span>
                          {showSitesDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                        Choose values once and apply them to every row in the table at once.
                      </p>

                      <div className="space-y-2.5 flex-1">
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
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">SOURCE</label>
                          <CustomSelect
                            value={batchSource}
                            onChange={(val) => setBatchSource(val)}
                            placeholder="Select source..."
                            className="w-full"
                            triggerClassName="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                            options={[
                              { value: "", label: "- None / Clear -" },
                              ...PRODUCT_SOURCE_OPTIONS,
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span>AFFILIATE NETWORK</span>
                            <span className="text-[9px] text-slate-400 lowercase font-normal">(multi / none)</span>
                          </label>
                          <AffiliateMultiSelect
                            value={batchAffiliate}
                            onChange={(val) => setBatchAffiliate(val)}
                            affiliates={affiliates}
                            placeholder="Select network(s)..."
                            triggerClassName="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
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

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">TREND LEVEL</label>
                          <CustomSelect
                            value={batchTrendLevel}
                            onChange={(val) => setBatchTrendLevel(val)}
                            placeholder="Select trend level..."
                            className="w-full"
                            triggerClassName="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                            options={[
                              { value: "HIGH", label: "High Trend" },
                              { value: "MODERATE", label: "Moderate Trend" },
                              { value: "LOW", label: "Low / Stable" },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">NATIVE PRODUCT</label>
                          <CustomSelect
                            value={batchIsNative}
                            onChange={(val) => setBatchIsNative(val)}
                            placeholder="Select native status..."
                            className="w-full"
                            triggerClassName="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                            options={[
                              { value: "true", label: "Yes (Native)" },
                              { value: "false", label: "No (Standard)" },
                            ]}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={applyBatchToAll}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs mt-3 cursor-pointer"
                      >
                        Apply to All Rows →
                      </button>
                    </div>
                  </div>

                  {/* Site Selection in Bulk Mode */}
                  {(showSitesDrawer || isProductResearcherRole) && (
                    <div className="p-3.5 bg-slate-50 dark:bg-[#131d31] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs animate-fadeIn">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                            Target Websites / Site Select
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              activeSites.length === 0
                                ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            }`}
                          >
                            {activeSites.length} of {previewSites.length} Sites Selected
                          </span>
                          {isProductResearcherRole && (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded">
                              None selected by default in Product Research
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setExcludedSiteIds([])}
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            type="button"
                            onClick={() => setExcludedSiteIds(previewSites.map((s: any) => s.id))}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            Clear All (None)
                          </button>
                        </div>
                      </div>

                      {isProductResearcherRole && activeSites.length === 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                          No websites selected. Products will be created directly in Product Research with 0 assigned sites. Click any website below if you wish to record specific target sites.
                        </p>
                      )}

                      {previewSites.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          No websites available for ({getCategoryNames() || "selected category"}).
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pt-1">
                          {previewSites.map((site: any) => {
                            const isSelected = !excludedSiteIds.includes(site.id);
                            return (
                              <button
                                key={site.id}
                                type="button"
                                onClick={() => {
                                  setExcludedSiteIds((prev) =>
                                    isSelected ? [...prev, site.id] : prev.filter((id) => id !== site.id)
                                  );
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                                  isSelected
                                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-700 font-bold shadow-2xs"
                                    : "bg-white dark:bg-[#0b1120] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-70"
                                }`}
                              >
                                <div
                                  className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                                    isSelected
                                      ? "bg-blue-600 border-blue-600 text-white"
                                      : "border-slate-300 dark:border-slate-600 bg-transparent text-transparent"
                                  }`}
                                >
                                  ✓
                                </div>
                                <span>{site.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section Divider & Title */}
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0">
                      <Table className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Product Table</span>
                    </div>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-2">
                      <span>{spreadsheetRows.filter((r) => r.name.trim()).length} products · {activeSites.length} preview site{activeSites.length !== 1 ? "s" : ""}</span>
                      {Object.values(bulkCheckResults).filter((r) => r.exists === false).length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> {Object.values(bulkCheckResults).filter((r) => r.exists === false).length} Available
                        </span>
                      )}
                      {Object.values(bulkCheckResults).filter((r) => r.exists === true).length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                          <AlertCircle className="w-3 h-3" /> {Object.values(bulkCheckResults).filter((r) => r.exists === true).length} Already in DB
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3. The Google Sheets Style Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-[#0b1120] flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto max-h-[50vh] overflow-y-auto flex-1">
                      <table className="w-full text-left border-collapse table-fixed min-w-[1300px]">
                        <thead className="bg-slate-100 dark:bg-[#162033] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                          <tr>
                            <th className="w-10 py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800/80">#</th>
                            <th className="w-[22%] min-w-[250px] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Product Name <span className="text-rose-500">*</span></th>
                            <th className="w-[10%] min-w-[110px] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Slug <span className="text-slate-400 dark:text-slate-500 text-[9px] font-normal lowercase">(auto)</span></th>
                            <th className="w-[12%] min-w-[140px] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Category <span className="text-rose-500">*</span></th>
                            <th className="w-[10%] min-w-[110px] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Source</th>
                            <th className="w-[14%] min-w-[150px] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Affiliate Network <span className="text-rose-500">*</span></th>
                            <th className="w-[8%] min-w-[100px] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Trend <span className="text-rose-500">*</span></th>
                            <th className="w-14 py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800/80">Native</th>
                            <th className="w-[10%] min-w-[110px] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Trend Link</th>
                            <th className="w-[10%] min-w-[110px] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Preview Link <span className="text-slate-400 font-normal text-[9px] lowercase">(optional)</span></th>
                            <th className="w-[8%] min-w-[90px] py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">Notes</th>
                            <th className="w-10 py-2.5 px-1 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                          {spreadsheetRows.map((row, idx) => {
                            const rowResult = bulkCheckResults[idx];
                            const isDuplicate = Boolean(rowResult?.exists);
                            const rowErrors = isDuplicate ? undefined : cellErrors[idx];

                            return (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                                <td className="py-2 px-2 text-center text-slate-400 dark:text-slate-500 font-bold bg-slate-50 dark:bg-slate-900/40 border-r border-slate-200 dark:border-slate-800/60 align-top">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/60 align-top">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={row.name}
                                      onChange={(e) => updateSpreadsheetRow(idx, "name", e.target.value)}
                                      placeholder={`Product name *`}
                                      className={`w-full px-2 py-1.5 text-xs font-semibold rounded-lg focus:outline-none transition-colors ${
                                        isDuplicate
                                          ? "border-2 border-rose-500 bg-rose-50/50 text-rose-900 focus:border-rose-600 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200"
                                          : (rowErrors?.name || (row.name.trim().length > 0 && row.name.trim().length < 2))
                                          ? "border border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-200"
                                          : rowResult?.isUncertain
                                          ? "border border-amber-400 bg-amber-50/30 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                                          : rowResult?.exists === false && row.name.trim().length >= 2
                                          ? "border border-emerald-400/80 bg-emerald-50/20 text-emerald-900 focus:border-emerald-500 dark:bg-emerald-950/20 dark:border-emerald-700/60 dark:text-emerald-200"
                                          : "text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238]"
                                      }`}
                                    />
                                  </div>
                                  {/* When a product already exists, show only the duplicate notification, with who added it and where. The inline text should not be truncated. */}
                                  {isDuplicate ? (
                                    <div
                                      className="text-[11px] font-bold text-rose-700 dark:text-rose-300 mt-1 p-1.5 bg-rose-50 dark:bg-rose-950/60 rounded-lg border border-rose-200 dark:border-rose-800/70 flex items-start gap-1.5 leading-snug animate-fadeIn whitespace-normal break-words shadow-2xs"
                                    >
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                                      <span className="whitespace-normal break-words">{rowResult?.message}</span>
                                    </div>
                                  ) : rowResult?.isUncertain ? (
                                    <div
                                      className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-1 p-1.5 bg-amber-50 dark:bg-amber-950/60 rounded-lg border border-amber-200 dark:border-amber-800/70 flex items-start gap-1.5 leading-snug animate-fadeIn whitespace-normal break-words shadow-2xs"
                                    >
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                      <span className="whitespace-normal break-words">{rowResult?.message}</span>
                                    </div>
                                  ) : rowErrors?.name ? (
                                    <p className="text-[10px] text-rose-500 font-semibold mt-0.5 px-0.5 leading-tight animate-fadeIn">
                                      {rowErrors.name}
                                    </p>
                                  ) : row.name.trim().length > 0 && row.name.trim().length < 2 ? (
                                    <p className="text-[10px] text-rose-500 font-semibold mt-0.5 px-0.5">
                                      Min 2 characters
                                    </p>
                                  ) : isBulkChecking && !rowResult && row.name.trim().length >= 2 ? (
                                    <p className="text-[10px] text-blue-500 font-medium mt-0.5 px-0.5 animate-pulse">
                                      Checking database...
                                    </p>
                                  ) : rowResult?.exists === false && row.name.trim().length >= 2 ? (
                                    <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 px-0.5 flex items-center gap-1 leading-tight animate-fadeIn">
                                      <Check className="w-3 h-3 shrink-0" />
                                      <span>Available</span>
                                    </p>
                                  ) : null}
                                </td>
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/60 align-top">
                                  <input
                                    type="text"
                                    value={row.slug}
                                    onChange={(e) => updateSpreadsheetRow(idx, "slug", e.target.value)}
                                    placeholder="auto-slug"
                                    className="w-full px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238] rounded-lg focus:outline-none"
                                  />
                                </td>
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/60 min-w-[140px] align-top">
                                  <CustomSelect
                                    value={row.category}
                                    onChange={(val) => updateSpreadsheetRow(idx, "category", val)}
                                    placeholder="Category *"
                                    searchable={true}
                                    searchPlaceholder="Search category..."
                                    portal={true}
                                    className="w-full"
                                    triggerClassName={`w-full px-2 py-1.5 rounded-lg text-xs font-medium focus:outline-none transition-colors ${
                                      rowErrors?.category
                                        ? "bg-rose-50/40 dark:bg-rose-950/30 border border-rose-500 dark:border-rose-700 text-rose-900 dark:text-rose-200"
                                        : "bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-slate-800 dark:text-slate-200"
                                    }`}
                                    options={productCategories.map((c) => ({ value: c.name, label: c.name }))}
                                  />
                                  {rowErrors?.category && (
                                    <span className="text-[10px] font-semibold text-rose-500 mt-0.5 block leading-tight px-0.5 animate-fadeIn">
                                      {rowErrors.category}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/60 min-w-[130px] align-top">
                                  <CustomSelect
                                    value={row.source || ""}
                                    onChange={(val) => updateSpreadsheetRow(idx, "source", val)}
                                    placeholder="Source..."
                                    portal={true}
                                    minWidth={130}
                                    className="w-full"
                                    triggerClassName="w-full px-2 py-1.5 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                                    options={[
                                      { value: "", label: "- None -" },
                                      ...PRODUCT_SOURCE_OPTIONS,
                                    ]}
                                  />
                                </td>
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/60 min-w-[140px] align-top">
                                  <AffiliateMultiSelect
                                    value={row.affiliateName}
                                    onChange={(val) => updateSpreadsheetRow(idx, "affiliateName", val)}
                                    affiliates={affiliates}
                                    placeholder="Affiliate * (or None)"
                                    compact={true}
                                    portal={true}
                                    minWidth={240}
                                    error={Boolean(rowErrors?.affiliateName)}
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
                                  {rowErrors?.affiliateName && (
                                    <span className="text-[10px] font-semibold text-rose-500 mt-0.5 block leading-tight px-0.5 animate-fadeIn">
                                      {rowErrors.affiliateName}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/60 align-top">
                                  <CustomSelect
                                    value={row.trendLevel}
                                    onChange={(val) => updateSpreadsheetRow(idx, "trendLevel", val)}
                                    portal={true}
                                    minWidth={120}
                                    className="w-full"
                                    triggerClassName={`w-full px-2 py-1.5 text-xs font-semibold rounded-lg ${
                                      rowErrors?.trendLevel
                                        ? "bg-rose-50/40 dark:bg-rose-950/30 border border-rose-500 text-rose-900"
                                        : "text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 hover:border-blue-500"
                                    }`}
                                    options={[
                                      { value: "HIGH", label: "High" },
                                      { value: "MODERATE", label: "Moderate" },
                                      { value: "LOW", label: "Low" },
                                    ]}
                                  />
                                  {rowErrors?.trendLevel && (
                                    <span className="text-[10px] font-semibold text-rose-500 mt-0.5 block leading-tight px-0.5 animate-fadeIn">
                                      {rowErrors.trendLevel}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/60 text-center align-top">
                                  <button
                                    type="button"
                                    onClick={() => updateSpreadsheetRow(idx, "isNative", !row.isNative)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer border w-full flex items-center justify-center gap-1 ${row.isNative
                                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                                      }`}
                                    title={row.isNative ? "Native Product (Click to toggle)" : "Standard Product (Click to toggle)"}
                                  >
                                    {row.isNative ? "Yes" : "No"}
                                  </button>
                                </td>
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/60 align-top">
                                  <input
                                    type="url"
                                    value={row.trendLink}
                                    onChange={(e) => updateSpreadsheetRow(idx, "trendLink", e.target.value)}
                                    placeholder="https://... (optional)"
                                    className={`w-full px-2 py-1.5 text-xs font-mono rounded-lg focus:outline-none ${
                                      rowErrors?.trendLink
                                        ? "border border-rose-500 bg-rose-50/40 text-rose-900 dark:bg-rose-950/30"
                                        : "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238]"
                                    }`}
                                  />
                                  {rowErrors?.trendLink && (
                                    <span className="text-[10px] font-semibold text-rose-500 mt-0.5 block leading-tight px-0.5 animate-fadeIn">
                                      {rowErrors.trendLink}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/60 align-top">
                                  <input
                                    type="url"
                                    value={row.previewLink}
                                    onChange={(e) => updateSpreadsheetRow(idx, "previewLink", e.target.value)}
                                    placeholder="https://... (optional)"
                                    className={`w-full px-2 py-1.5 text-xs font-mono rounded-lg focus:outline-none ${
                                      rowErrors?.previewLink
                                        ? "border border-rose-500 bg-rose-50/40 text-rose-900 dark:bg-rose-950/30"
                                        : "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238]"
                                    }`}
                                  />
                                  {rowErrors?.previewLink && (
                                    <span className="text-[10px] font-semibold text-rose-500 mt-0.5 block leading-tight px-0.5 animate-fadeIn">
                                      {rowErrors.previewLink}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/60 align-top">
                                  <input
                                    type="text"
                                    value={row.remarks}
                                    onChange={(e) => updateSpreadsheetRow(idx, "remarks", e.target.value)}
                                    placeholder="Notes..."
                                    className="w-full px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#131d31] border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-[#162238] rounded-lg focus:outline-none"
                                  />
                                </td>
                                <td className="py-2 px-1 text-center align-top">
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
                            );
                          })}
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
                    {(() => {
                      const duplicateRowsCount = spreadsheetRows.filter((r, idx) => r.name.trim().length >= 2 && bulkCheckResults[idx]?.exists).length;
                      const hasDuplicates = duplicateRowsCount > 0;
                      const validCount = spreadsheetRows.filter((r) => r.name.trim()).length;
                      const isAddDisabled = validCount === 0 || submitting || hasDuplicates || isBulkChecking;
                      return (
                        <button
                          type="button"
                          disabled={isAddDisabled}
                          onClick={handleSubmit}
                          title={hasDuplicates ? `Remove or rename ${duplicateRowsCount} duplicate product(s) to continue` : undefined}
                          className={`py-2.5 px-6 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                            hasDuplicates
                              ? "bg-rose-600/80 text-white cursor-not-allowed opacity-80 shadow-xs"
                              : isAddDisabled
                              ? "bg-blue-600 text-white opacity-40 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-lg shadow-blue-600/20 cursor-pointer"
                          }`}
                        >
                          {submitting ? (
                            "Saving Products..."
                          ) : hasDuplicates ? (
                            `Blocked: ${duplicateRowsCount} Duplicate${duplicateRowsCount > 1 ? "s" : ""} Found`
                          ) : (
                            `Add ${validCount} Products to ${getCategoryNames() || "Selected Type"}`
                          )}
                        </button>
                      );
                    })()}
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
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/[^a-zA-Z0-9 ]/.test(val)) {
                            toast.error("Special characters are not allowed. Only letters, numbers, and spaces are permitted.", { id: "site-char-error" });
                          }
                          setNewSiteName(val.replace(/[^a-zA-Z0-9 ]/g, ""));
                        }}
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

                  {/* Site Assignment Mode */}
                  {isProductResearcherRole ? (
                    <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/50 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide">
                          Product Research Mode
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-600 text-white ml-auto">
                          Research Pool
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                        This product will be saved to the Product Research catalog with recorded site availability. It will not be assigned to live publishing sites or writers until a Linker publishes it.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-slate-50 dark:bg-[#131d31] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            Site Assignment Mode
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            In Product Research, add as 1 product — Linkers can publish to other sites later.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setDistributeToAllSites(false)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            !distributeToAllSites
                              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/40 text-blue-950 dark:text-white"
                              : "bg-white dark:bg-[#0b1120] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">1 Site (Product Research)</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-blue-600 text-white uppercase">
                              Recommended
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Creates 1 product. Linkers review and add to other network sites when ready.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDistributeToAllSites(true)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            distributeToAllSites
                              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/40 text-blue-950 dark:text-white"
                              : "bg-white dark:bg-[#0b1120] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">Distribute to All Sites</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              Multi-site
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Duplicates this product across all matching websites immediately.
                          </p>
                        </button>
                      </div>

                      {!distributeToAllSites && previewSites.length > 0 && (
                        <div className="pt-1">
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Primary Website Target
                          </label>
                          <select
                            value={selectedSingleSiteId || previewSites[0]?.id || ""}
                            onChange={(e) => setSelectedSingleSiteId(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                          >
                            {previewSites.map((site: any) => (
                              <option key={site.id} value={site.id}>
                                {site.name} {site.url ? `(${site.url})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {previewSites.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 italic">
                      No websites found for selected categories. Click "+ Add Website" above to configure one.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-1 px-1">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {activeSites.length} of {previewSites.length} Sites Selected {isProductResearcherRole && <span className="text-amber-600 dark:text-amber-400 font-semibold">(None by default in Product Research)</span>}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setExcludedSiteIds([])}
                            className="px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            type="button"
                            onClick={() => setExcludedSiteIds(previewSites.map((s: any) => s.id))}
                            className="px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded transition cursor-pointer"
                          >
                            Clear All (None)
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto p-1 pr-2">
                        {previewSites.map((site: any) => {
                          const isExcluded = excludedSiteIds.includes(site.id);
                          return (
                            <div
                              key={site.id}
                              className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all ${isExcluded
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
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md font-bold shrink-0">
                                    {isProductResearcherRole ? "Unselected" : "Excluded"}
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 px-2 py-0.5 rounded-md font-bold shrink-0">
                                    {isProductResearcherRole ? "Target Site" : "Auto-assigned"}
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
                                className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 shrink-0 ${isExcluded
                                  ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-600/10"
                                  : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                  }`}
                                title={isExcluded ? "Select this site" : "Deselect this site"}
                              >
                                {isExcluded ? (
                                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">+ Select</span>
                                ) : (
                                  <>
                                    <X className="w-4 h-4 text-slate-400 hover:text-rose-600" />
                                    <span className="text-[11px] font-bold text-slate-500 hover:text-rose-600">Deselect</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
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
                      <div className="relative">
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => update("name", e.target.value)}
                          placeholder="e.g. Alpha Whey Protein"
                          className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all shadow-xs ${form.name.trim().length > 0 && form.name.trim().length < 2
                              ? "border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
                              : singleCheckStatus.exists
                                ? "border-rose-500 bg-rose-50/20 text-rose-900 dark:text-rose-200 focus:border-rose-600 focus:ring-1 focus:ring-rose-500/30"
                                : singleCheckStatus.exists === false && form.name.trim().length >= 2
                                  ? "border-emerald-500 bg-emerald-50/20 text-emerald-900 dark:text-emerald-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/30"
                                  : "border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                            }`}
                        />
                        {singleCheckStatus.checking && (
                          <span className="absolute right-3 top-3 text-[10px] font-bold text-blue-500 flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                            Checking...
                          </span>
                        )}
                      </div>
                      {form.name.trim().length > 0 && form.name.trim().length < 2 ? (
                        <p className="text-xs font-semibold text-rose-500">
                          Product name must be at least 2 characters.
                        </p>
                      ) : singleCheckStatus.checking ? (
                        <p className="text-xs font-medium text-blue-500 flex items-center gap-1 animate-pulse">
                          <span>Checking database availability...</span>
                        </p>
                      ) : singleCheckStatus.exists ? (
                        <div className="text-xs font-bold text-rose-700 dark:text-rose-300 p-2 bg-rose-50 dark:bg-rose-950/60 rounded-xl border border-rose-200 dark:border-rose-800/70 flex items-start gap-2 animate-fadeIn whitespace-normal break-words shadow-2xs">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                          <span className="whitespace-normal break-words">{singleCheckStatus.message}</span>
                        </div>
                      ) : singleCheckStatus.isUncertain ? (
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 p-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-200 dark:border-amber-800/70 flex items-start gap-2 animate-fadeIn whitespace-normal break-words shadow-2xs">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                          <span className="whitespace-normal break-words">{singleCheckStatus.message}</span>
                        </div>
                      ) : singleCheckStatus.exists === false && form.name.trim().length >= 2 ? (
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 animate-fadeIn">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>Available to add on all target sites</span>
                        </p>
                      ) : null}
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

                  {hasCountrySpecificSite && (
                    <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          Target Country / Market <span className="text-slate-400 font-normal text-[10px] normal-case">(Optional - Default: Worldwide)</span>
                        </label>
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">
                          Country-specific Site
                        </span>
                      </div>
                      <CustomSelect
                        value={form.country || ""}
                        onChange={(val) => update("country", val)}
                        placeholder="Default / Global (Worldwide)"
                        className="w-full"
                        options={[
                          { value: "", label: "Default / Global (Worldwide)" },
                          ...TIER1_CODES.map((code) => ({
                            value: code,
                            label: `${getCountryFlag(code)} ${COUNTRY_NAMES[code] || code} (${code})`,
                          })),
                          ...LATAM_COUNTRIES.map((c) => ({
                            value: c.code,
                            label: `${getCountryFlag(c.code)} ${c.name} (${c.code})`,
                          })),
                        ]}
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Products with the same name on this site are allowed if they target different countries.
                      </p>
                    </div>
                  )}

                  {/* Native Product Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          Native Product
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${form.isNative
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                            }`}
                        >
                          {form.isNative ? "Native" : "Standard"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Specify whether this is a native product or standard/third-party
                      </p>
                    </div>
                    <button
                      type="button"
                      id="modal-toggle-is-native"
                      role="switch"
                      aria-checked={form.isNative}
                      onClick={() => update("isNative", !form.isNative)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${form.isNative ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${form.isNative ? "translate-x-5" : "translate-x-0"
                          }`}
                      />
                    </button>
                  </div>

                  {/* Product Source Field */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Source
                        <span className="text-slate-400 font-normal text-[10px] normal-case">(Select product source)</span>
                      </label>
                      {form.source && (
                        <button
                          type="button"
                          onClick={() => update("source", "")}
                          className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PRODUCT_SOURCE_OPTIONS.map((opt) => {
                        const isSelected = form.source === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => update("source", isSelected ? "" : opt.value)}
                            className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${isSelected
                                ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white ring-2 ring-zinc-900/20 dark:ring-white/20 font-bold"
                                : "bg-white dark:bg-[#0b1120] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                              }`}
                          >
                            {isSelected && <Check className="w-3 h-3 shrink-0" />}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
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
                        triggerClassName={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium focus:outline-none transition-colors ${
                          fieldErrors.category
                            ? "bg-rose-50/40 border border-rose-500 text-rose-900 dark:bg-rose-950/30 dark:border-rose-700 dark:text-rose-200"
                            : "bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-slate-800 dark:text-slate-200"
                        }`}
                        options={productCategories.map((c) => ({ value: c.name, label: c.name }))}
                      />
                      {fieldErrors.category && (
                        <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">{fieldErrors.category}</p>
                      )}
                    </div>

                    {/* Affiliate Network Multi-Select */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          Affiliate Network <span className="text-rose-500">*</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal normal-case">
                          Select multiple or No Affiliate
                        </span>
                      </label>
                      <AffiliateMultiSelect
                        value={form.affiliateName}
                        onChange={(val) => {
                          setForm((prev) => ({ ...prev, affiliateName: val }));
                          setFieldErrors((prev) => {
                            if (!prev.affiliateName) return prev;
                            const next = { ...prev };
                            delete next.affiliateName;
                            return next;
                          });
                        }}
                        affiliates={affiliates}
                        placeholder="Select Affiliate Network(s)... *"
                        error={Boolean(fieldErrors.affiliateName)}
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
                      {fieldErrors.affiliateName && (
                        <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">{fieldErrors.affiliateName}</p>
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
                        triggerClassName={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium focus:outline-none transition-colors ${
                          fieldErrors.trendLevel
                            ? "bg-rose-50/40 border border-rose-500 text-rose-900 dark:bg-rose-950/30 dark:border-rose-700 dark:text-rose-200"
                            : "bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-slate-800 dark:text-slate-200"
                        }`}
                        options={[
                          { value: "HIGH", label: "High Trend" },
                          { value: "MODERATE", label: "Moderate Trend" },
                          { value: "LOW", label: "Low / Stable" },
                        ]}
                      />
                      {fieldErrors.trendLevel && (
                        <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">{fieldErrors.trendLevel}</p>
                      )}
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
                        className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all shadow-xs ${fieldErrors.trendLink
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
                        Preview Link URL <span className="text-slate-400 font-normal text-[10px] normal-case">(Optional)</span>
                      </label>
                      <input
                        id="input-preview-link"
                        type="url"
                        value={form.previewLink}
                        onChange={(e) => update("previewLink", e.target.value)}
                        placeholder="https://... (optional)"
                        className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#0b1120] border rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all shadow-xs ${fieldErrors.previewLink
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
                    {(() => {
                      const isDuplicate = Boolean(singleCheckStatus.exists);
                      const isSingleDisabled = submitting || singleCheckStatus.checking || isDuplicate;
                      return (
                        <button
                          type="button"
                          disabled={isSingleDisabled}
                          onClick={handleSubmit}
                          title={isDuplicate ? "This product already exists. Please rename to continue." : undefined}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                            isDuplicate
                              ? "bg-rose-600/80 text-white cursor-not-allowed opacity-80 shadow-xs"
                              : isSingleDisabled
                              ? "bg-blue-600 text-white opacity-40 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-lg shadow-blue-600/20 cursor-pointer"
                          }`}
                        >
                          {submitting
                            ? "Saving..."
                            : isDuplicate
                            ? "Blocked: Product Already Exists"
                            : "Add Product"}
                        </button>
                      );
                    })()}
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
