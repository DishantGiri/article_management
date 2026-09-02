"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import FormattedRemarks from "@/components/FormattedRemarks";
import CustomSelect from "@/components/CustomSelect";
import { Check, Globe, X } from "lucide-react";

interface Product {
  id: number;
  name: string;
  trendLink?: string | null;
  previewLink?: string | null;
  site: { name: string; url?: string | null };
  article?: { articleLink?: string | null };
}

interface EditLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  link: {
    id: number;
    productId: number;
    affiliateName: string;
    affiliateLink: string;
    bridgePageLink?: string | null;
    buyLink?: string | null;
    status: string;
    linkerRemarks?: string | null;
    geos: { geo: string }[];
  } | null;
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

export default function EditLinkModal({ isOpen, onClose, onSuccess, link }: EditLinkModalProps) {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [dbAffiliates, setDbAffiliates] = useState<{ id: number; name: string }[]>([]);
  const [dbGeos, setDbGeos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [productId, setProductId] = useState("");
  const [affiliateName, setAffiliateName] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [bridgePageLink, setBridgePageLink] = useState("");
  const [buyLink, setBuyLink] = useState("");
  const [status, setStatus] = useState("REQUESTED");
  const [linkerRemarks, setLinkerRemarks] = useState("");
  const [geos, setGeos] = useState<string[]>([]);

  const [affiliateLinkError, setAffiliateLinkError] = useState("");
  const [bridgePageLinkError, setBridgePageLinkError] = useState("");
  const [buyLinkError, setBuyLinkError] = useState("");

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === productId),
    [products, productId]
  );

  const productSlug = useMemo(() => {
    if (!selectedProduct?.name) return "";
    return selectedProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }, [selectedProduct]);

  const siteBaseUrl = useMemo(() => {
    if (!selectedProduct?.site?.url) return "";
    return selectedProduct.site.url.replace(/\/+$/, "");
  }, [selectedProduct]);

  // Dynamic link options for Bridge Page Link
  const bridgeLinkOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    if (bridgePageLink) {
      opts.push({ value: bridgePageLink, label: `Current: ${bridgePageLink}` });
    }
    if (siteBaseUrl && productSlug) {
      const u = `${siteBaseUrl}/${productSlug}`;
      if (u !== bridgePageLink) opts.push({ value: u, label: `Landing Page: ${u}` });
    }
    if (selectedProduct?.article?.articleLink && selectedProduct.article.articleLink !== bridgePageLink) {
      opts.push({ value: selectedProduct.article.articleLink, label: `Article: ${selectedProduct.article.articleLink}` });
    }
    if (siteBaseUrl && siteBaseUrl !== bridgePageLink) {
      opts.push({ value: siteBaseUrl, label: `Site Home: ${siteBaseUrl}` });
    }
    return opts;
  }, [siteBaseUrl, productSlug, selectedProduct, bridgePageLink]);

  // Dynamic link options for Buy Link
  const buyLinkOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    if (buyLink) {
      opts.push({ value: buyLink, label: `Current: ${buyLink}` });
    }
    if (siteBaseUrl && productSlug) {
      const u = `${siteBaseUrl}/${productSlug}`;
      if (u !== buyLink) opts.push({ value: u, label: `Direct Buy: ${u}` });
    }
    if (affiliateLink && affiliateLink !== buyLink) {
      opts.push({ value: affiliateLink, label: `Affiliate Link: ${affiliateLink}` });
    }
    return opts;
  }, [siteBaseUrl, productSlug, buyLink, affiliateLink]);

  // Dynamic link options for Affiliate Link
  const affiliateLinkOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    if (affiliateLink) {
      opts.push({ value: affiliateLink, label: `Current: ${affiliateLink}` });
    }
    if (selectedProduct?.trendLink && selectedProduct.trendLink !== affiliateLink) {
      opts.push({ value: selectedProduct.trendLink, label: `Trend: ${selectedProduct.trendLink}` });
    }
    if (selectedProduct?.previewLink && selectedProduct.previewLink !== affiliateLink) {
      opts.push({ value: selectedProduct.previewLink, label: `Preview: ${selectedProduct.previewLink}` });
    }
    if (siteBaseUrl && productSlug) {
      const u = `${siteBaseUrl}/aff/${productSlug}`;
      if (u !== affiliateLink) opts.push({ value: u, label: `Affiliate Tag: ${u}` });
    }
    return opts;
  }, [affiliateLink, selectedProduct, siteBaseUrl, productSlug]);

  useEffect(() => {
    if (isOpen && link) {
      setProductId(link.productId?.toString() || "");
      setAffiliateName(link.affiliateName || "");
      setAffiliateLink(link.affiliateLink || "");
      setBridgePageLink(link.bridgePageLink || "");
      setBuyLink(link.buyLink || "");
      setStatus(link.status || "REQUESTED");
      const cleanRemarks = (link.linkerRemarks || "")
        .split('\n')
        .filter(line => !line.trim().startsWith("[Flagged by"))
        .join('\n')
        .trim();
      setLinkerRemarks(cleanRemarks || "Standard affiliate setup — links verified active");
      setGeos(link.geos?.map((g) => g.geo) || []);

      fetch("/api/affiliates")
        .then(r => r.json())
        .then(data => { setDbAffiliates(Array.isArray(data) ? data : []); })
        .catch(e => console.error("Failed to load affiliates", e));

      fetch("/api/geos")
        .then(r => r.json())
        .then(data => { setDbGeos(Array.isArray(data) ? data.map((g: any) => g.code || g.name || g) : []); })
        .catch(e => console.error("Failed to load geos", e));

      setError("");
      setAffiliateLinkError("");
      setBridgePageLinkError("");
      setBuyLinkError("");

      const mockUserId = session?.user?.id || 1;
      setLoadingProducts(true);
      fetch(`/api/products?userId=${mockUserId}`)
        .then((r) => r.json())
        .then((data) => {
          const fetchedProds = Array.isArray(data) ? data : [];
          setProducts(fetchedProds);
        })
        .catch(() => setError("Failed to load products"))
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, link, session]);

  const toggleGeo = (geo: string) => {
    setGeos((prev) => (prev.includes(geo) ? prev.filter((g) => g !== geo) : [...prev, geo]));
  };

  const allAffiliates = dbAffiliates.map(a => a.name);
  const allGeos = dbGeos;

  // All required fields must be filled before enabling submit
  const isFormValid =
    !!affiliateName.trim() &&
    !!affiliateLink.trim() &&
    isValidUrl(affiliateLink) &&
    !affiliateLinkError &&
    !bridgePageLinkError &&
    !buyLinkError &&
    geos.length > 0;

  const handleSubmit = async () => {
    if (!link) return;

    if (!productId || !affiliateName || !affiliateLink) {
      setError("Product, Affiliate Name, and Affiliate Link are required.");
      return;
    }

    if (geos.length === 0) {
      setError("At least one GEO must be selected.");
      return;
    }

    if (affiliateLinkError || bridgePageLinkError || buyLinkError) {
      setError("Please fix all URL validation errors before submitting.");
      return;
    }

    if (!isValidUrl(affiliateLink)) {
      setError("Please enter a valid Affiliate Link URL");
      return;
    }

    if (bridgePageLink && !isValidUrl(bridgePageLink)) {
      setError("Please enter a valid Bridge Page Link URL");
      return;
    }

    if (buyLink && !isValidUrl(buyLink)) {
      setError("Please enter a valid Buy Link URL");
      return;
    }

    if (buyLink && !bridgePageLink) {
      setError("Bridge Page Link is required before adding a Buy Link.");
      return;
    }

    if (status === "ACCEPTED" && !bridgePageLink?.trim()) {
      setError("Bridge Page Link is required before setting status to Accepted.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const mockUserId = session?.user?.id || 1;

      const res = await fetch(`/api/links/${link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: parseInt(productId),
          updatedById: mockUserId,
          affiliateName,
          affiliateLink,
          bridgePageLink: bridgePageLink || null,
          buyLink: buyLink || null,
          status,
          linkerRemarks: linkerRemarks || null,
          geos,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update link");
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to update link");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !link) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors">
        {/* Header */}
        <div className="px-6 py-4 bg-[#4A4A4A] dark:bg-slate-800 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Edit Link Log #{link.id}</h2>
            <p className="text-xs text-[#EAEAEA] dark:text-slate-300 font-medium">Update link routing details via dropdown selectors</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-white dark:bg-slate-900">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 rounded-xl text-red-700 dark:text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {link.linkerRemarks && link.linkerRemarks.includes("[Flagged by") && (
            <div className="mb-2">
              <FormattedRemarks remarks={link.linkerRemarks} />
            </div>
          )}

          {/* Product Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Product *</label>
            <CustomSelect
              value={productId}
              onChange={(val) => setProductId(val)}
              placeholder="Select Product from Dropdown..."
              disabled={loadingProducts}
              searchable={true}
              searchPlaceholder="Search product..."
              options={products.map((p) => ({
                value: String(p.id),
                label: `${p.name} (${p.site.name})`,
              }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Affiliate Name Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Affiliate Name *</label>
              <CustomSelect
                value={affiliateName}
                onChange={(val) => setAffiliateName(val)}
                placeholder="Select Affiliate Network..."
                searchable={true}
                searchPlaceholder="Search or select affiliate..."
                allowCustom={true}
                options={allAffiliates.map((name) => ({ value: name, label: name }))}
              />
            </div>

            {/* Affiliate Link Text Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Affiliate Link URL *</label>
              <input
                type="text"
                value={affiliateLink}
                onChange={(e) => {
                  const val = e.target.value;
                  setAffiliateLink(val);
                  if (val && !isValidUrl(val)) {
                    setAffiliateLinkError("Must start with http:// or https://");
                  } else {
                    setAffiliateLinkError("");
                  }
                }}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 focus:border-[#6D8196] placeholder:text-slate-400 transition"
              />
              {affiliateLinkError && (
                <p className="text-[11px] font-semibold text-rose-500 mt-1">{affiliateLinkError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bridge Page Link Text Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Bridge Page Link</label>
              <input
                type="text"
                value={bridgePageLink}
                onChange={(e) => {
                  const val = e.target.value;
                  setBridgePageLink(val);
                  if (!val) setBuyLink("");
                  if (val && !isValidUrl(val)) {
                    setBridgePageLinkError("Must start with http:// or https://");
                  } else {
                    setBridgePageLinkError("");
                  }
                }}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 focus:border-[#6D8196] placeholder:text-slate-400 transition"
              />
              {bridgePageLinkError && (
                <p className="text-[11px] font-semibold text-rose-500 mt-1">{bridgePageLinkError}</p>
              )}
            </div>

            {/* Buy Link Text Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Buy Link</label>
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
                <p className="text-[11px] font-semibold text-rose-500 mt-1">{buyLinkError}</p>
              )}
            </div>
          </div>

          {/* Geos Dropdown & Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                Target Geos <span className="text-rose-500">*</span>
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
              searchPlaceholder="Search country code..."
              options={[
                { value: "TIER_1", label: "⭐ Add Tier 1 Pack (US, UK, CA, AU)" },
                { value: "ALL", label: "🌐 Add All Available GEOs" },
                ...allGeos.map((g) => ({
                  value: g,
                  label: geos.includes(g) ? `✓ ${g} (Selected)` : `+ Add ${g}`,
                })),
              ]}
            />

            {geos.length === 0 ? (
              <p className="text-[10px] text-rose-500 font-semibold">At least one GEO is required.</p>
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

          {/* Link Status Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Link Status</label>
            <CustomSelect
              value={status}
              onChange={(val) => setStatus(val)}
              placeholder="Select Link Status..."
              options={LINK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>

          {/* Remarks Text Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Remarks Template</label>
            <input
              type="text"
              value={linkerRemarks}
              onChange={(e) => setLinkerRemarks(e.target.value)}
              placeholder="Enter remarks..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 focus:border-[#6D8196] placeholder:text-slate-400 transition"
            />
          </div>

          {/* Footer actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#CBCBCB]/40 dark:border-slate-800">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-xl border border-[#CBCBCB] dark:border-slate-700 text-[#4A4A4A] dark:text-slate-300 font-semibold hover:bg-[#FAF9F5] dark:hover:bg-slate-800 transition text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !isFormValid}
              type="button"
              title={!isFormValid ? "Please fill in all required fields" : undefined}
              className="px-5 py-2.5 rounded-xl bg-[#6D8196] text-white font-semibold hover:bg-[#5A6D81] disabled:opacity-40 disabled:cursor-not-allowed transition text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
