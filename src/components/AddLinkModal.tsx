import CustomSelect from "@/components/CustomSelect";
import { Link2, AlertCircle, Tag, X, Plus, Building2, Globe, Check, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";

interface Product {
  id: number;
  name: string;
  trendLink?: string | null;
  previewLink?: string | null;
  linkLogs?: any[];
  site: {
    id: number;
    name: string;
    url?: string | null;
  };
  article?: {
    articleLink?: string | null;
  };
}

interface DbAffiliate {
  id: number;
  name: string;
}

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedProductId?: number | null;
}

const LINK_STATUSES = [
  { value: "REQUESTED", label: "Requested" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "CANCELED", label: "Canceled" },
  { value: "ISSUE", label: "Issue" },
  { value: "NEED_TO_CHECK", label: "Need to check in future" },
  { value: "PRESELL_PAGE", label: "Presell page" },
  { value: "REDIRECTED", label: "Redirected" },
];

const REMARK_TEMPLATES = [
  { value: "Standard affiliate setup — links verified active", label: "Standard affiliate setup — links verified active" },
  { value: "Bridge page live & redirecting to buy page", label: "Bridge page live & redirecting to buy page" },
  { value: "Direct purchase link configured for site", label: "Direct purchase link configured for site" },
  { value: "Under review — waiting for affiliate network approval", label: "Under review — waiting for affiliate approval" },
  { value: "Presell page active with multi-geo routing", label: "Presell page active with multi-geo routing" },
  { value: "Need to check in future — potential link/stock change", label: "Need to check in future — potential link change" },
  { value: "No remarks / clean configuration", label: "No remarks / clean configuration" },
];

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

export default function AddLinkModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedProductId,
}: AddLinkModalProps) {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [bridgePageLink, setBridgePageLink] = useState("");
  const [buyLink, setBuyLink] = useState("");
  const [affiliateEntries, setAffiliateEntries] = useState<
    Array<{ affiliateName: string; affiliateLink: string; linkError?: string }>
  >([{ affiliateName: "", affiliateLink: "" }]);
  const [geos, setGeos] = useState<string[]>([]);
  const [status, setStatus] = useState("REQUESTED");
  const [linkerRemarks, setLinkerRemarks] = useState("Standard affiliate setup — links verified active");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bridgeLinkError, setBridgeLinkError] = useState("");
  const [buyLinkError, setBuyLinkError] = useState("");

  const [dbAffiliates, setDbAffiliates] = useState<DbAffiliate[]>([]);
  const [dbGeos, setDbGeos] = useState<string[]>([]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const allAffiliates = useMemo(() => dbAffiliates.map((a) => a.name), [dbAffiliates]);
  const allGeos = dbGeos;

  const productSlug = useMemo(() => {
    if (!selectedProduct?.name) return "";
    return selectedProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }, [selectedProduct]);

  const siteBaseUrl = useMemo(() => {
    if (!selectedProduct?.site?.url) return "";
    return selectedProduct.site.url.replace(/\/+$/, "");
  }, [selectedProduct]);

  // Dropdown options for Bridge Page Link
  const bridgeLinkOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    if (siteBaseUrl && productSlug) {
      opts.push({
        value: `${siteBaseUrl}/${productSlug}`,
        label: `Landing Page: ${siteBaseUrl}/${productSlug}`,
      });
    }
    if (selectedProduct?.article?.articleLink) {
      opts.push({
        value: selectedProduct.article.articleLink,
        label: `Writer Article Link: ${selectedProduct.article.articleLink}`,
      });
    }
    if (siteBaseUrl) {
      opts.push({
        value: siteBaseUrl,
        label: `Site Root URL: ${siteBaseUrl}`,
      });
    }
    return opts;
  }, [siteBaseUrl, productSlug, selectedProduct]);

  // Dropdown options for Buy Link
  const buyLinkOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    if (siteBaseUrl && productSlug) {
      opts.push({
        value: `${siteBaseUrl}/${productSlug}`,
        label: `Direct Buy / Landing: ${siteBaseUrl}/${productSlug}`,
      });
    }
    if (affiliateEntries[0]?.affiliateLink) {
      opts.push({
        value: affiliateEntries[0].affiliateLink,
        label: `Primary Affiliate URL: ${affiliateEntries[0].affiliateLink}`,
      });
    }
    if (selectedProduct?.trendLink) {
      opts.push({
        value: selectedProduct.trendLink,
        label: `Product Trend Link: ${selectedProduct.trendLink}`,
      });
    }
    if (selectedProduct?.previewLink) {
      opts.push({
        value: selectedProduct.previewLink,
        label: `Product Preview Link: ${selectedProduct.previewLink}`,
      });
    }
    return opts;
  }, [siteBaseUrl, productSlug, affiliateEntries, selectedProduct]);

  // Dropdown options for Affiliate Links
  const affiliateLinkOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    if (selectedProduct?.trendLink) {
      opts.push({
        value: selectedProduct.trendLink,
        label: `Trend URL: ${selectedProduct.trendLink}`,
      });
    }
    if (selectedProduct?.previewLink) {
      opts.push({
        value: selectedProduct.previewLink,
        label: `Preview URL: ${selectedProduct.previewLink}`,
      });
    }
    if (selectedProduct?.article?.articleLink) {
      opts.push({
        value: selectedProduct.article.articleLink,
        label: `Article URL: ${selectedProduct.article.articleLink}`,
      });
    }
    if (siteBaseUrl && productSlug) {
      opts.push({
        value: `${siteBaseUrl}/aff/${productSlug}`,
        label: `Affiliate Tag: ${siteBaseUrl}/aff/${productSlug}`,
      });
      opts.push({
        value: `${siteBaseUrl}/${productSlug}`,
        label: `Direct Link: ${siteBaseUrl}/${productSlug}`,
      });
    }
    return opts;
  }, [selectedProduct, siteBaseUrl, productSlug]);

  const addAffiliateEntry = () => {
    const defaultAffLink = affiliateLinkOptions[0]?.value || "";
    setAffiliateEntries((prev) => [
      ...prev,
      { affiliateName: allAffiliates[0] || "", affiliateLink: defaultAffLink },
    ]);
  };

  const removeAffiliateEntry = (index: number) => {
    if (affiliateEntries.length <= 1) return;
    setAffiliateEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAffiliateEntry = (index: number, field: "affiliateName" | "affiliateLink", value: string) => {
    setAffiliateEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        const updated = { ...entry, [field]: value };
        if (field === "affiliateLink") {
          if (value && !isValidUrl(value)) {
            updated.linkError = "Must start with http:// or https:// and be a valid URL";
          } else {
            delete updated.linkError;
          }
        }
        return updated;
      })
    );
  };

  useEffect(() => {
    if (isOpen) {
      setLoadingProducts(true);
      setError("");
      setStatus("REQUESTED");
      setLinkerRemarks("Standard affiliate setup — links verified active");
      setBridgePageLink("");
      setBuyLink("");
      setAffiliateEntries([{ affiliateName: "", affiliateLink: "" }]);
      setGeos([]);

      Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/affiliates").then((r) => r.json()),
        fetch("/api/geos").then((r) => r.json()),
      ])
        .then(([prodData, affData, geoData]) => {
          const prods = Array.isArray(prodData) ? prodData : [];
          setProducts(prods);

          if (Array.isArray(affData)) setDbAffiliates(affData);
          if (Array.isArray(geoData)) setDbGeos(geoData.map((g: any) => g.name || g.code || g));

          if (preselectedProductId) {
            setSelectedProductId(preselectedProductId);
          } else if (prods.length > 0) {
            setSelectedProductId(prods[0].id);
          }
        })
        .catch((err) => {
          console.error("Failed to load initial data", err);
          setError("Failed to load products/affiliates list");
        })
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, preselectedProductId]);

  // Auto-fill smart link defaults on product select
  useEffect(() => {
    if (!selectedProduct) return;
    const slug = selectedProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const base = selectedProduct.site?.url ? selectedProduct.site.url.replace(/\/+$/, "") : "";
    const autoBridge = selectedProduct.article?.articleLink || (base ? `${base}/${slug}` : "");
    const autoBuy = base ? `${base}/${slug}` : "";
    const autoAffLink = selectedProduct.trendLink || selectedProduct.previewLink || (base ? `${base}/aff/${slug}` : "");

    setBridgePageLink(autoBridge);
    setBuyLink(autoBuy);
    setBridgeLinkError("");
    setBuyLinkError("");

    setAffiliateEntries((prev) => {
      const defaultAffName = allAffiliates[0] || "";
      if (prev.length === 0 || (!prev[0].affiliateName && !prev[0].affiliateLink)) {
        return [{ affiliateName: defaultAffName, affiliateLink: autoAffLink }];
      }
      return prev.map((entry, idx) => {
        if (idx === 0) {
          return {
            ...entry,
            affiliateName: entry.affiliateName || defaultAffName,
            affiliateLink: entry.affiliateLink || autoAffLink,
          };
        }
        return entry;
      });
    });

    if (allGeos.length > 0 && geos.length === 0) {
      setGeos(allGeos.slice(0, 4)); // Default to Tier 1 GEOs (e.g. US, UK, CA, AU)
    }
  }, [selectedProduct, allAffiliates, allGeos]);

  const toggleGeo = (geo: string) => {
    setGeos((prev) => (prev.includes(geo) ? prev.filter((g) => g !== geo) : [...prev, geo]));
  };

  const isFormValid =
    !!selectedProductId &&
    affiliateEntries.length > 0 &&
    affiliateEntries.every(
      (e) => !!e.affiliateName.trim() && !!e.affiliateLink.trim() && isValidUrl(e.affiliateLink) && !e.linkError
    ) &&
    !bridgeLinkError &&
    !buyLinkError &&
    geos.length > 0;

  const handleSubmit = async () => {
    if (!selectedProductId || !selectedProduct) {
      setError("Product is required.");
      return;
    }

    if (affiliateEntries.some((e) => !e.affiliateName.trim() || !e.affiliateLink.trim())) {
      setError("Affiliate Name and Affiliate Link are required for all network entries.");
      return;
    }

    if (geos.length === 0) {
      setError("At least one GEO must be selected.");
      return;
    }

    if (affiliateEntries.some((e) => e.linkError || !isValidUrl(e.affiliateLink)) || bridgeLinkError || buyLinkError) {
      setError("Please fix all URL validation errors before submitting.");
      return;
    }

    if (buyLink && !bridgePageLink) {
      setError(`Bridge Page Link is required before a Buy Link can be added.`);
      return;
    }

    if (bridgePageLink && !isValidUrl(bridgePageLink)) {
      setError(`Please enter a valid Bridge Page Link (must start with http:// or https://)`);
      return;
    }

    if (buyLink && !isValidUrl(buyLink)) {
      setError(`Please enter a valid Buy Link (must start with http:// or https://)`);
      return;
    }

    if (status === "ACCEPTED" && !bridgePageLink?.trim()) {
      setError("Bridge Page Link is required before setting status to Accepted.");
      return;
    }

    if (session?.user?.role === "TEAM_LEAD") {
      setError("Access Denied: Team Leads cannot add links. Only Linkers and Admins can add links.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const mockUserId = session?.user?.id || 1;

      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          addedById: mockUserId,
          bridgePageLink: bridgePageLink || null,
          buyLink: buyLink || null,
          affiliateEntries: affiliateEntries.map((a) => ({
            affiliateName: a.affiliateName.trim(),
            affiliateLink: a.affiliateLink.trim(),
          })),
          affiliateName: affiliateEntries[0]?.affiliateName.trim() || "",
          affiliateLink: affiliateEntries[0]?.affiliateLink.trim() || "",
          geos,
          status,
          linkerRemarks: linkerRemarks || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add link");
      }

      toast.success(`Successfully added ${affiliateEntries.length} link log entry(ies)!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-6 py-4 bg-[#4A4A4A] dark:bg-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6D8196]/30 border border-[#6D8196]/40 flex items-center justify-center text-white shadow-inner">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Add New Link Log
                {selectedProduct && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#6D8196]/30 text-white border border-[#6D8196]/40">
                    Site: {selectedProduct.site?.name}
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#EAEAEA] dark:text-slate-300 font-medium">
                Configure affiliate links and site-specific landing pages via dropdown selections
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#FAF9F5]/50 dark:bg-slate-950">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Product Selection (Dropdown) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2 shadow-2xs">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Product <span className="text-rose-500">*</span>
            </label>
            <CustomSelect
              value={selectedProductId ? String(selectedProductId) : ""}
              onChange={(val) => setSelectedProductId(val ? Number(val) : null)}
              placeholder="Select Product from Dropdown..."
              disabled={loadingProducts || !!preselectedProductId}
              searchable={true}
              searchPlaceholder="Search products by name or site..."
              options={products.map((p) => {
                const isUnlinked = !p.linkLogs || p.linkLogs.length === 0;
                return {
                  value: String(p.id),
                  label: `${p.name} — (Site: ${p.site?.name || "Unassigned"}) ${isUnlinked ? "⚠️ (Needs Link Logs)" : ""}`,
                };
              })}
            />
          </div>

          {/* Section 2: Affiliate Info (Dropdowns) */}
          <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Affiliate Network & Link Selection <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={addAffiliateEntry}
                className="text-xs font-bold text-[#6D8196] hover:text-[#5A6D81] dark:text-sky-400 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Another Network
              </button>
            </div>

            <div className="space-y-3">
              {affiliateEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[#FAF9F5] dark:bg-slate-800/60 border border-[#CBCBCB]/60 dark:border-slate-700 rounded-xl space-y-2.5 relative shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#6D8196] dark:text-sky-400 uppercase tracking-wider">
                      Network #{idx + 1}
                    </span>
                    {affiliateEntries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAffiliateEntry(idx)}
                        className="text-xs font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        title="Remove network"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Remove</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Affiliate Name Dropdown */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        Affiliate Name <span className="text-rose-500">*</span>
                      </label>
                      <CustomSelect
                        value={entry.affiliateName}
                        onChange={(val) => updateAffiliateEntry(idx, "affiliateName", val)}
                        placeholder="Select Affiliate Network..."
                        searchable={true}
                        searchPlaceholder="Search or pick affiliate..."
                        allowCustom={true}
                        options={allAffiliates.map((name) => ({ value: name, label: name }))}
                      />
                    </div>

                    {/* Affiliate Link Dropdown */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        Affiliate Link URL <span className="text-rose-500">*</span>
                      </label>
                      <CustomSelect
                        value={entry.affiliateLink}
                        onChange={(val) => updateAffiliateEntry(idx, "affiliateLink", val)}
                        placeholder="Select Link from Product..."
                        searchable={true}
                        searchPlaceholder="Select link or enter URL..."
                        allowCustom={true}
                        options={affiliateLinkOptions}
                      />
                      {entry.linkError && <p className="text-[10px] font-semibold text-rose-500">{entry.linkError}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Configure Site-Specific Link (Dropdowns) */}
          {selectedProduct && (
            <div className="border border-[#CBCBCB]/60 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#CBCBCB]/40 dark:border-slate-800">
                <h3 className="text-xs font-bold text-[#4A4A4A] dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#6D8196]" />
                  Site: <span className="text-[#6D8196] dark:text-sky-400">{selectedProduct.site?.name}</span>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-[#CBCBCB]/60 dark:border-slate-700">
                    Product ID: #{selectedProduct.id}
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Bridge Page Link Text Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Bridge Page Link
                  </label>
                  <input
                    type="text"
                    value={bridgePageLink}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBridgePageLink(val);
                      if (val && !isValidUrl(val)) {
                        setBridgeLinkError("Must start with http:// or https://");
                      } else {
                        setBridgeLinkError("");
                      }
                    }}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 focus:border-[#6D8196] placeholder:text-slate-400 transition"
                  />
                  {bridgeLinkError && (
                    <p className="text-[10px] font-semibold text-rose-500 mt-1">{bridgeLinkError}</p>
                  )}
                </div>

                {/* Buy Link Text Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Buy Link
                  </label>
                  <input
                    type="text"
                    value={buyLink}
                    disabled={!bridgePageLink}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBuyLink(val);
                      if (val && !isValidUrl(val)) {
                        setBuyLinkError("Must start with http:// or https://");
                      } else {
                        setBuyLinkError("");
                      }
                    }}
                    placeholder={bridgePageLink ? "https://..." : "Enter bridge page link first"}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 focus:border-[#6D8196] placeholder:text-slate-400 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-800"
                  />
                  {buyLinkError && (
                    <p className="text-[10px] font-semibold text-rose-500 mt-1">{buyLinkError}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Target GEOs (Dropdown & Presets) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Target GEOs <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGeos([...allGeos])}
                  className="text-xs font-bold text-[#6D8196] hover:text-[#4A4A4A] dark:text-sky-400 cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setGeos([])}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* GEO Selection Dropdown */}
            <CustomSelect
              value=""
              onChange={(val) => {
                if (!val) return;
                if (val === "TIER_1") {
                  const tier1 = ["US", "UK", "CA", "AU"].filter((g) => allGeos.includes(g));
                  setGeos(Array.from(new Set([...geos, ...tier1])));
                } else if (val === "ALL") {
                  setGeos([...allGeos]);
                } else {
                  toggleGeo(val);
                }
              }}
              placeholder="Select Target GEO from Dropdown..."
              searchable={true}
              searchPlaceholder="Search country code (US, UK, CA...)"
              options={[
                { value: "TIER_1", label: "⭐ Add Tier 1 Pack (US, UK, CA, AU)" },
                { value: "ALL", label: "🌐 Add All Available GEOs" },
                ...allGeos.map((g) => ({
                  value: g,
                  label: geos.includes(g) ? `✓ ${g} (Selected)` : `+ Add ${g}`,
                })),
              ]}
            />

            {/* Selected GEO tags */}
            {geos.length === 0 ? (
              <p className="text-xs text-rose-500 font-semibold">At least one GEO is required.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {geos.map((geo) => (
                  <span
                    key={geo}
                    onClick={() => toggleGeo(geo)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#6D8196] text-white shadow-2xs cursor-pointer hover:bg-rose-600 transition-colors"
                    title="Click to remove"
                  >
                    <Check className="w-3 h-3" />
                    <span>{geo}</span>
                    <X className="w-3 h-3 opacity-70 hover:opacity-100" />
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Link Status & Remarks (Dropdowns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Link Status
              </label>
              <CustomSelect
                value={status}
                onChange={(val) => setStatus(val)}
                placeholder="Select Link Status..."
                options={LINK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Remarks Template
              </label>
              <CustomSelect
                value={linkerRemarks}
                onChange={(val) => setLinkerRemarks(val)}
                placeholder="Select Remarks from Dropdown..."
                searchable={true}
                searchPlaceholder="Select remark or type custom..."
                allowCustom={true}
                options={REMARK_TEMPLATES}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {selectedProduct ? (
              <span className="text-[#6D8196] dark:text-sky-300 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                1 link log entry ready for {selectedProduct.site?.name}
              </span>
            ) : (
              <span>Select a product above</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-white dark:hover:bg-slate-800 transition text-xs cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !isFormValid}
              type="button"
              title={
                !isFormValid
                  ? "Please fill in all required fields: Product, Affiliate Name, Affiliate Link, and at least one GEO"
                  : undefined
              }
              className="px-5 py-2.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] active:scale-[0.98] text-white font-bold text-xs shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {submitting ? "Saving..." : "Add 1 Link Log"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
