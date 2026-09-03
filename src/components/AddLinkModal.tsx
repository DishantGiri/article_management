import CustomSelect from "@/components/CustomSelect";
import { Link2, AlertCircle, Tag, X, Plus, Building2, Globe, Check, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import { LATAM_CODES, COUNTRY_NAMES, getGeoDisplayName, getCountryFlag } from "@/lib/geo-constants";

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

interface CountryLinkEntry {
  geo: string;
  affiliateName: string;
  affiliateLink: string;
  linkError?: string;
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

  // Country-specific links state
  const [useCountrySpecificLinks, setUseCountrySpecificLinks] = useState(true);
  const [countryLinks, setCountryLinks] = useState<CountryLinkEntry[]>([]);
  const [batchLinkUrl, setBatchLinkUrl] = useState("");
  const [defaultAffiliateName, setDefaultAffiliateName] = useState("");
  const [countrySearchQuery, setCountrySearchQuery] = useState("");

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

  // Synchronize countryLinks whenever geos change
  useEffect(() => {
    setCountryLinks((prev) => {
      const defName = defaultAffiliateName || allAffiliates[0] || "Standard";
      const autoLink = selectedProduct?.trendLink || selectedProduct?.previewLink || "";
      return geos.map((geo) => {
        const existing = prev.find((p) => p.geo.toUpperCase() === geo.toUpperCase());
        if (existing) {
          return {
            ...existing,
            affiliateName: existing.affiliateName || defName,
          };
        }
        return {
          geo,
          affiliateName: defName,
          affiliateLink: autoLink,
        };
      });
    });
  }, [geos, defaultAffiliateName, allAffiliates, selectedProduct]);

  const toggleGeo = (geo: string) => {
    setGeos((prev) => (prev.includes(geo) ? prev.filter((g) => g !== geo) : [...prev, geo]));
  };

  const updateCountryLink = (geo: string, field: "affiliateName" | "affiliateLink", value: string) => {
    setCountryLinks((prev) =>
      prev.map((item) => {
        if (item.geo.toUpperCase() !== geo.toUpperCase()) return item;
        const updated = { ...item, [field]: value };
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

  const applyBatchLinkToAll = () => {
    if (!batchLinkUrl.trim()) {
      toast.error("Please enter a link URL to apply");
      return;
    }
    if (!isValidUrl(batchLinkUrl.trim())) {
      toast.error("Please enter a valid URL (starting with http:// or https://)");
      return;
    }
    setCountryLinks((prev) =>
      prev.map((c) => ({
        ...c,
        affiliateLink: batchLinkUrl.trim(),
        linkError: undefined,
      }))
    );
    toast.success(`Applied link to all ${countryLinks.length} country(ies)!`);
  };

  const handleDefaultAffiliateChange = (newName: string) => {
    setDefaultAffiliateName(newName);
    setCountryLinks((prev) =>
      prev.map((c) => ({
        ...c,
        affiliateName: newName,
      }))
    );
  };

  const removeCountry = (geo: string) => {
    setGeos((prev) => prev.filter((g) => g.toUpperCase() !== geo.toUpperCase()));
  };

  const addCountryDirectly = (geo: string) => {
    if (!geo) return;
    if (!geos.includes(geo)) {
      setGeos((prev) => [...prev, geo]);
    }
  };

  const isFormValid =
    !!selectedProductId &&
    geos.length > 0 &&
    (useCountrySpecificLinks
      ? countryLinks.length > 0 &&
        countryLinks.every((c) => !!c.affiliateLink.trim() && isValidUrl(c.affiliateLink) && !c.linkError)
      : affiliateEntries.length > 0 &&
        affiliateEntries.every(
          (e) => !!e.affiliateName.trim() && !!e.affiliateLink.trim() && isValidUrl(e.affiliateLink) && !e.linkError
        )) &&
    !bridgeLinkError &&
    !buyLinkError;

  const handleSubmit = async () => {
    if (!selectedProductId || !selectedProduct) {
      setError("Product is required.");
      return;
    }

    if (geos.length === 0) {
      setError("At least one GEO must be selected.");
      return;
    }

    const entriesToCreate = useCountrySpecificLinks
      ? countryLinks.map((c) => ({
          affiliateName: c.affiliateName.trim() || defaultAffiliateName || allAffiliates[0] || "Standard",
          affiliateLink: c.affiliateLink.trim(),
          geos: [c.geo],
        }))
      : affiliateEntries.map((a) => ({
          affiliateName: a.affiliateName.trim(),
          affiliateLink: a.affiliateLink.trim(),
          geos: geos,
        }));

    if (entriesToCreate.length === 0) {
      setError("Please configure at least one country link.");
      return;
    }

    if (entriesToCreate.some((e) => !e.affiliateName.trim() || !e.affiliateLink.trim())) {
      setError("Affiliate Name and Affiliate Link are required for all country/network entries.");
      return;
    }

    if (
      entriesToCreate.some((e) => !isValidUrl(e.affiliateLink)) ||
      bridgeLinkError ||
      buyLinkError
    ) {
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
          affiliateEntries: entriesToCreate,
          affiliateName: entriesToCreate[0]?.affiliateName.trim() || "",
          affiliateLink: entriesToCreate[0]?.affiliateLink.trim() || "",
          geos,
          status,
          linkerRemarks: linkerRemarks || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add link");
      }

      toast.success(
        useCountrySpecificLinks
          ? `Successfully added ${entriesToCreate.length} country link log(s)!`
          : `Successfully added ${affiliateEntries.length} link log entry(ies)!`
      );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-md p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[96vw] max-w-6xl flex flex-col max-h-[94vh] border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-[#4A4A4A] dark:bg-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white shadow-inner">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Add New Link Log</span>
                {selectedProduct && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/20">
                    Site: {selectedProduct.site?.name}
                  </span>
                )}
              </h2>
              <p className="text-xs text-white/80 font-normal">
                Configure affiliate links and site-specific landing pages via dropdown selections
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-[#FAF9F5]/60 dark:bg-slate-950">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Product Selection (Dropdown) */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Product <span className="text-rose-500">*</span>
              </label>
              {selectedProduct && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  ID: <strong className="text-slate-800 dark:text-slate-200">#{selectedProduct.id}</strong>
                </span>
              )}
            </div>

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

            {/* Product Quick-Info Bar if selected */}
            {selectedProduct && (
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Assigned Site</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{selectedProduct.site?.name || "None"}</span>
                  </div>
                </div>

                {selectedProduct.previewLink && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Preview Link</span>
                      <a href={selectedProduct.previewLink} target="_blank" rel="noreferrer" className="font-mono text-blue-600 dark:text-blue-400 hover:underline truncate block text-[11px]">
                        {selectedProduct.previewLink}
                      </a>
                    </div>
                  </div>
                )}

                {selectedProduct.trendLink && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Trend Link</span>
                      <a href={selectedProduct.trendLink} target="_blank" rel="noreferrer" className="font-mono text-blue-600 dark:text-blue-400 hover:underline truncate block text-[11px]">
                        {selectedProduct.trendLink}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Target GEOs (Placed directly after Product Name) */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Target GEOs <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  {geos.length} Selected
                </span>
              </div>

              {/* Quick Actions & Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const tier1 = ["US", "UK", "CA", "AU"].filter((g) => allGeos.length === 0 || allGeos.includes(g));
                    setGeos(Array.from(new Set([...geos, ...tier1])));
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
                >
                  ⭐ Add Tier 1 (US, UK, CA, AU)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGeos(Array.from(new Set([...geos, ...LATAM_CODES])));
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer flex items-center gap-1"
                >
                  🌎 Add LATAM (27 Countries)
                </button>
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
                  const tier1 = ["US", "UK", "CA", "AU"].filter((g) => allGeos.length === 0 || allGeos.includes(g));
                  setGeos(Array.from(new Set([...geos, ...tier1])));
                } else if (val === "LATAM") {
                  setGeos(Array.from(new Set([...geos, ...LATAM_CODES])));
                } else if (val === "ALL") {
                  setGeos([...allGeos]);
                } else {
                  toggleGeo(val);
                }
              }}
              placeholder="Select Target GEO from Dropdown..."
              searchable={true}
              searchPlaceholder="Search country name or code (Mexico, Brazil, US, UK...)"
              options={[
                { value: "TIER_1", label: "⭐ Add Tier 1 Pack (US, UK, CA, AU)" },
                { value: "LATAM", label: "🌎 Add LATAM Pack (27 Countries: Mexico, Brazil, Argentina...)" },
                { value: "ALL", label: "🌐 Add All Available GEOs" },
                ...allGeos.map((g) => ({
                  value: g,
                  label: geos.includes(g) ? `✓ ${getGeoDisplayName(g)} (Selected)` : `+ Add ${getGeoDisplayName(g)}`,
                })),
              ]}
            />

            {/* Selected GEO tags */}
            {geos.length === 0 ? (
              <p className="text-xs text-rose-500 font-semibold flex items-center gap-1.5 pt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                At least one Target GEO is required.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {geos.map((geo) => {
                  const countryName = COUNTRY_NAMES[geo.toUpperCase()];
                  const display = countryName && countryName.toUpperCase() !== geo.toUpperCase() ? `${geo} (${countryName})` : geo;
                  return (
                    <span
                      key={geo}
                      onClick={() => toggleGeo(geo)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#6D8196] text-white shadow-2xs cursor-pointer hover:bg-rose-600 transition-colors group"
                      title={`Click to remove ${getGeoDisplayName(geo)}`}
                    >
                      <Check className="w-3 h-3" />
                      <span>{display}</span>
                      <X className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Country-Specific Links (Different Links per Country) */}
          <div className="space-y-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Country Links & Affiliate Networks <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure specific affiliate tracking links for each target country
                </p>
              </div>

              {/* Mode switch & counter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {useCountrySpecificLinks
                    ? `${countryLinks.filter((c) => c.affiliateLink.trim()).length} / ${countryLinks.length} Links Ready`
                    : `${affiliateEntries.length} Network(s)`}
                </span>
                <button
                  type="button"
                  onClick={() => setUseCountrySpecificLinks(!useCountrySpecificLinks)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {useCountrySpecificLinks ? "Switch to single shared link" : "Switch to country-specific links"}
                </button>
              </div>
            </div>

            {useCountrySpecificLinks ? (
              <div className="space-y-3">
                {/* Quick Batch Toolbar */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="sm:w-56 shrink-0">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Default Network for All
                      </label>
                      <CustomSelect
                        value={defaultAffiliateName}
                        onChange={handleDefaultAffiliateChange}
                        placeholder="Select Network..."
                        searchable={true}
                        allowCustom={true}
                        options={allAffiliates.map((n) => ({ value: n, label: n }))}
                      />
                    </div>

                    <div className="flex-1 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        ⚡ Quick Fill / Template Link for All Countries
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={batchLinkUrl}
                          onChange={(e) => setBatchLinkUrl(e.target.value)}
                          placeholder="Paste base URL to fill all countries (e.g. https://admitad.com/offer)..."
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                        <button
                          type="button"
                          onClick={applyBatchLinkToAll}
                          disabled={!batchLinkUrl.trim() || countryLinks.length === 0}
                          className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                        >
                          Apply to All ({countryLinks.length})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Suggestions / Shortcuts */}
                  {affiliateLinkOptions.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap pt-0.5">
                      <span className="font-semibold text-slate-400">Quick template shortcuts:</span>
                      {affiliateLinkOptions.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setBatchLinkUrl(opt.value)}
                          className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                        >
                          {opt.label.split(":")[0]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Filter bar & Add country link */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                  {countryLinks.length > 4 && (
                    <input
                      type="text"
                      value={countrySearchQuery}
                      onChange={(e) => setCountrySearchQuery(e.target.value)}
                      placeholder="🔍 Filter country in list (e.g. Mexico, Brazil, US)..."
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <div className="w-56">
                      <CustomSelect
                        value=""
                        onChange={addCountryDirectly}
                        placeholder="+ Add Another Country..."
                        searchable={true}
                        options={allGeos
                          .filter((g) => !geos.includes(g))
                          .map((g) => ({
                            value: g,
                            label: `+ ${getCountryFlag(g)} ${getGeoDisplayName(g)}`,
                          }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Country Link Cards / Rows */}
                {countryLinks.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
                    <Globe className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      No target countries selected yet
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                      Select target GEOs above or use one of the quick packs:
                    </p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setGeos(Array.from(new Set([...geos, ...LATAM_CODES])))}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                      >
                        🌎 Add LATAM Pack (27 Countries)
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeos(Array.from(new Set([...geos, "US", "UK", "CA", "AU"])))}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
                      >
                        ⭐ Add Tier 1 Pack (US, UK, CA, AU)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
                    {countryLinks
                      .filter((item) => {
                        if (!countrySearchQuery.trim()) return true;
                        const q = countrySearchQuery.trim().toLowerCase();
                        const name = (COUNTRY_NAMES[item.geo.toUpperCase()] || "").toLowerCase();
                        return item.geo.toLowerCase().includes(q) || name.includes(q);
                      })
                      .map((item) => {
                        const countryName = COUNTRY_NAMES[item.geo.toUpperCase()];
                        const flag = getCountryFlag(item.geo);
                        return (
                          <div
                            key={item.geo}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 flex flex-col md:flex-row items-stretch md:items-center gap-3 shadow-2xs hover:border-blue-400/60 transition"
                          >
                            {/* Country Tag (Width ~190px) */}
                            <div className="md:w-52 shrink-0 flex items-center justify-between md:justify-start gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{flag}</span>
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate block">
                                    {countryName || item.geo}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase block">
                                    GEO: {item.geo}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeCountry(item.geo)}
                                className="text-slate-400 hover:text-rose-500 md:hidden cursor-pointer"
                                title="Remove"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Affiliate Network Dropdown (Width ~170px) */}
                            <div className="md:w-44 shrink-0">
                              <CustomSelect
                                value={item.affiliateName}
                                onChange={(val) => updateCountryLink(item.geo, "affiliateName", val)}
                                placeholder="Select Network..."
                                searchable={true}
                                allowCustom={true}
                                options={allAffiliates.map((n) => ({ value: n, label: n }))}
                              />
                            </div>

                            {/* Link Input (Flex-1) */}
                            <div className="flex-1 space-y-1">
                              <input
                                type="text"
                                value={item.affiliateLink}
                                onChange={(e) => updateCountryLink(item.geo, "affiliateLink", e.target.value)}
                                placeholder={`https://... (Link for ${countryName || item.geo})`}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                              />
                              {item.linkError && (
                                <p className="text-[10px] font-semibold text-rose-500">{item.linkError}</p>
                              )}
                            </div>

                            {/* Remove button (Desktop) */}
                            <button
                              type="button"
                              onClick={() => removeCountry(item.geo)}
                              className="hidden md:flex w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 items-center justify-center transition cursor-pointer shrink-0"
                              title={`Remove ${countryName || item.geo}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : (
              /* Fallback Single Shared Network Mode */
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Add common affiliate networks that apply to all selected GEOs:</span>
                  <button
                    type="button"
                    onClick={addAffiliateEntry}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Another Network
                  </button>
                </div>

                {affiliateEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 relative shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        Network #{idx + 1}
                      </span>
                      {affiliateEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAffiliateEntry(idx)}
                          className="text-xs font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="Remove network"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      {/* Affiliate Name Dropdown (5 cols) */}
                      <div className="md:col-span-5 space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">
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

                      {/* Affiliate Link Text Input (7 cols) */}
                      <div className="md:col-span-7 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                            Affiliate Link URL <span className="text-rose-500">*</span>
                          </label>
                          {affiliateLinkOptions.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400">Quick fill:</span>
                              {affiliateLinkOptions.slice(0, 2).map((opt, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => updateAffiliateEntry(idx, "affiliateLink", opt.value)}
                                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                  {opt.label.split(":")[0]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="text"
                          value={entry.affiliateLink}
                          onChange={(e) => updateAffiliateEntry(idx, "affiliateLink", e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 placeholder:text-slate-400 transition"
                        />
                        {entry.linkError && <p className="text-[10px] font-semibold text-rose-500">{entry.linkError}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Configure Site-Specific Link (Dropdowns) */}
          {selectedProduct && (
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Site: <span className="text-blue-600 dark:text-blue-400">{selectedProduct.site?.name}</span>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    Product ID: #{selectedProduct.id}
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Bridge Page Link Text Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                      Bridge Page Link
                    </label>
                    {bridgeLinkOptions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (bridgeLinkOptions[0]?.value) {
                            setBridgePageLink(bridgeLinkOptions[0].value);
                            setBridgeLinkError("");
                          }
                        }}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Use Auto Landing
                      </button>
                    )}
                  </div>
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
                    placeholder="https://test.com/product-slug"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 placeholder:text-slate-400 transition"
                  />
                  {bridgeLinkError && (
                    <p className="text-[10px] font-semibold text-rose-500">{bridgeLinkError}</p>
                  )}
                </div>

                {/* Buy Link Text Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                      Buy Link
                    </label>
                    {buyLinkOptions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (buyLinkOptions[0]?.value) {
                            setBuyLink(buyLinkOptions[0].value);
                            setBuyLinkError("");
                          }
                        }}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Use Auto Buy
                      </button>
                    )}
                  </div>
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
                    placeholder={bridgePageLink ? "https://test.com/product-slug" : "Enter bridge page link first"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 placeholder:text-slate-400 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-800"
                  />
                  {buyLinkError && (
                    <p className="text-[10px] font-semibold text-rose-500">{buyLinkError}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Link Status & Remarks (Dropdowns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
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
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Remarks Template
              </label>
              <input
                type="text"
                value={linkerRemarks}
                onChange={(e) => setLinkerRemarks(e.target.value)}
                placeholder="Enter remarks..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 placeholder:text-slate-400 transition"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {selectedProduct ? (
              <span className="text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {useCountrySpecificLinks ? countryLinks.length : affiliateEntries.length} link log{" "}
                {(useCountrySpecificLinks ? countryLinks.length : affiliateEntries.length) !== 1 ? "entries" : "entry"}{" "}
                ready for {selectedProduct.site?.name}
              </span>
            ) : (
              <span>Select a product above</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              type="button"
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-white dark:hover:bg-slate-800 transition text-xs cursor-pointer shadow-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !isFormValid}
              type="button"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {submitting
                ? "Saving..."
                : `Add ${useCountrySpecificLinks ? countryLinks.length : affiliateEntries.length} Link Log${
                    (useCountrySpecificLinks ? countryLinks.length : affiliateEntries.length) !== 1 ? "s" : ""
                  }`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
