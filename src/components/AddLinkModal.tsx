"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import {
  Sparkles,
  Copy,
  CheckSquare,
  Square,
  Search,
  Plus,
  X,
  Globe,
  Building2,
  Link2,
  Zap,
  Check,
  RotateCcw,
  AlertCircle,
  Tag,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  linkLogs?: any[];
  site: {
    id: number;
    name: string;
    url?: string | null;
    subId?: string | null;
    bridgeUrl?: string | null;
    buyUrl?: string | null;
  };
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

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function AddLinkModal({ isOpen, onClose, onSuccess, preselectedProductId }: AddLinkModalProps) {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [globalSettings, setGlobalSettings] = useState<{ defaultSubId?: string; defaultBridgeUrl?: string }>({});
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [selectedProductName, setSelectedProductName] = useState<string>("");
  const [siteLinks, setSiteLinks] = useState<Record<number, { bridgePageLink: string; buyLink: string }>>({});
  const [selectedSites, setSelectedSites] = useState<Record<number, boolean>>({});
  const [affiliateName, setAffiliateName] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [geos, setGeos] = useState<string[]>([]);
  const [status, setStatus] = useState("REQUESTED");
  const [linkerRemarks, setLinkerRemarks] = useState("");
  const [bulkBuyLink, setBulkBuyLink] = useState("");
  const [siteSearchQuery, setSiteSearchQuery] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [affiliateLinkError, setAffiliateLinkError] = useState("");
  const [siteLinkErrors, setSiteLinkErrors] = useState<Record<string, { bridgePageLink?: string; buyLink?: string }>>({});
  const [dbAffiliates, setDbAffiliates] = useState<{ id: number; name: string }[]>([]);
  const [dbGeos, setDbGeos] = useState<string[]>([]);

  const [showAddAffiliate, setShowAddAffiliate] = useState(false);
  const [newAffiliateName, setNewAffiliateName] = useState("");
  const [addingAffiliate, setAddingAffiliate] = useState(false);

  const handleInlineAddAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAffiliateName.trim()) return;
    setAddingAffiliate(true);
    setError("");
    try {
      const res = await fetch("/api/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAffiliateName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add affiliate");
      setDbAffiliates((prev) => [...prev, data]);
      setAffiliateName(data.name);
      setNewAffiliateName("");
      setShowAddAffiliate(false);
      toast.success(`Affiliate "${data.name}" added successfully!`);
    } catch (err: any) {
      setError(err.message || "Failed to add affiliate");
    } finally {
      setAddingAffiliate(false);
    }
  };

  // Get unique product names for the dropdown list
  const uniqueProductNames = useMemo(() => Array.from(new Set(products.map((p) => p.name))), [products]);

  // Get matching products for the selected product name
  const matchingProducts = useMemo(() => products.filter((p) => p.name === selectedProductName), [products, selectedProductName]);
  
  // Filtered matching products by site search query
  const filteredMatchingProducts = useMemo(() => {
    if (!siteSearchQuery.trim()) return matchingProducts;
    const q = siteSearchQuery.toLowerCase();
    return matchingProducts.filter((p) => p.site?.name?.toLowerCase().includes(q) || p.id.toString().includes(q));
  }, [matchingProducts, siteSearchQuery]);

  // Only submit for sites the linker has checked
  const activeProducts = useMemo(() => matchingProducts.filter((p) => selectedSites[p.id]), [matchingProducts, selectedSites]);

  const allAffiliates = useMemo(() => dbAffiliates.map((a) => a.name), [dbAffiliates]);
  const allGeos = dbGeos;

  useEffect(() => {
    if (isOpen) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => setGlobalSettings(data))
        .catch((e) => console.error("Failed to load settings", e));

      fetch("/api/affiliates")
        .then((r) => r.json())
        .then((data) => setDbAffiliates(Array.isArray(data) ? data : []))
        .catch((e) => console.error("Failed to load affiliates", e));

      fetch("/api/geos")
        .then((r) => r.json())
        .then((data) => setDbGeos(Array.isArray(data) ? data.map((g: any) => g.code) : []))
        .catch((e) => console.error("Failed to load geos", e));

      setSelectedProductName("");
      setSiteLinks({});
      setSelectedSites({});
      setAffiliateName("");
      setAffiliateLink("");
      setGeos([]);
      setStatus("REQUESTED");
      setLinkerRemarks("");
      setBulkBuyLink("");
      setSiteSearchQuery("");
      setError("");
      setAffiliateLinkError("");
      setSiteLinkErrors({});

      const mockUserId = session?.user?.id || 1;
      setLoadingProducts(true);
      fetch(`/api/products?userId=${mockUserId}`)
        .then((r) => r.json())
        .then((data) => {
          const fetchedProds = Array.isArray(data) ? data : [];
          setProducts(fetchedProds);

          if (preselectedProductId) {
            const found = fetchedProds.find((p: any) => p.id === preselectedProductId);
            if (found) {
              setSelectedProductName(found.name);
            }
          }
        })
        .catch(() => setError("Failed to load products"))
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, preselectedProductId, session?.user?.id]);

  // When selected product name changes, initialize inputs for all matching sites with auto-generated bridge & buy links
  useEffect(() => {
    if (!selectedProductName) return;

    const matching = products.filter((p) => p.name === selectedProductName);
    const initialInputs: Record<number, { bridgePageLink: string; buyLink: string }> = {};
    const initialSelection: Record<number, boolean> = {};

    matching.forEach((p) => {
      const slug = slugify(p.name);
      const baseBridge = (p.site?.bridgeUrl || globalSettings.defaultBridgeUrl || p.site?.url || "").trim();
      let autoBridgeLink = "";
      if (baseBridge) {
        const cleanBase = baseBridge.replace(/\/+$/, "");
        autoBridgeLink = `${cleanBase}/${slug}`;
      }

      const baseBuy = (p.site?.buyUrl || p.site?.bridgeUrl || p.site?.url || "").trim();
      let autoBuyLink = "";
      if (baseBuy) {
        const cleanBuyBase = baseBuy.replace(/\/+$/, "");
        autoBuyLink = `${cleanBuyBase}/${slug}`;
      }

      initialInputs[p.id] = { bridgePageLink: autoBridgeLink, buyLink: autoBuyLink };
      initialSelection[p.id] = preselectedProductId ? p.id === preselectedProductId : true;
    });

    setSiteLinks(initialInputs);
    setSelectedSites(initialSelection);
    setSiteLinkErrors({});
  }, [selectedProductName, products, globalSettings, preselectedProductId]);

  // Auto-fill Bridge & Buy links for all selected sites
  const handleAutoFillLinks = () => {
    if (!selectedProductName) return;
    const slug = slugify(selectedProductName);
    let count = 0;

    setSiteLinks((prev) => {
      const updated = { ...prev };
      matchingProducts.forEach((p) => {
        if (selectedSites[p.id]) {
          const current = updated[p.id] || { bridgePageLink: "", buyLink: "" };
          let newBridge = current.bridgePageLink;
          let newBuy = current.buyLink;

          const baseBridge = (p.site?.bridgeUrl || globalSettings.defaultBridgeUrl || p.site?.url || "").trim();
          if (baseBridge) {
            const cleanBase = baseBridge.replace(/\/+$/, "");
            newBridge = `${cleanBase}/${slug}`;
          }

          const baseBuy = (p.site?.buyUrl || p.site?.bridgeUrl || p.site?.url || "").trim();
          if (baseBuy) {
            const cleanBuyBase = baseBuy.replace(/\/+$/, "");
            newBuy = `${cleanBuyBase}/${slug}`;
          }

          updated[p.id] = { bridgePageLink: newBridge, buyLink: newBuy };
          count++;
        }
      });
      return updated;
    });

    if (count > 0) {
      toast.success(`Auto-filled site links for ${count} site(s)!`);
    } else {
      toast.error("No base URL configured for selected sites.");
    }
  };

  // Bulk Apply Buy Link to all selected sites
  const handleApplyBulkBuyLink = (targetLink?: string) => {
    const linkToApply = targetLink || bulkBuyLink || affiliateLink;
    if (!linkToApply) {
      toast.error("Please enter a Buy Link or Affiliate Link first.");
      return;
    }
    if (!isValidUrl(linkToApply)) {
      toast.error("Link must start with http:// or https://");
      return;
    }

    let count = 0;
    setSiteLinks((prev) => {
      const updated = { ...prev };
      matchingProducts.forEach((p) => {
        if (selectedSites[p.id]) {
          updated[p.id] = {
            ...(updated[p.id] || { bridgePageLink: "" }),
            buyLink: linkToApply,
          };
          count++;
        }
      });
      return updated;
    });

    toast.success(`Applied Buy Link to ${count} selected site(s)!`);
  };

  // Toggle All Sites selection
  const handleSelectAllSites = (select: boolean) => {
    const updated: Record<number, boolean> = {};
    matchingProducts.forEach((p) => {
      updated[p.id] = select;
    });
    setSelectedSites(updated);
  };

  const toggleGeo = (geo: string) => {
    setGeos((prev) => (prev.includes(geo) ? prev.filter((g) => g !== geo) : [...prev, geo]));
  };

  const toggleSite = (productId: number) => {
    setSelectedSites((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const updateSiteLink = (productId: number, field: "bridgePageLink" | "buyLink", value: string) => {
    setSiteLinks((prev) => {
      const current = prev[productId] || { bridgePageLink: "", buyLink: "" };
      const updated = { ...current, [field]: value };

      if (field === "bridgePageLink" && !value) {
        updated.buyLink = "";
      }
      return {
        ...prev,
        [productId]: updated,
      };
    });

    if (field === "bridgePageLink" && !value) {
      setSiteLinkErrors((prev) => {
        const next = { ...prev };
        if (next[productId]) {
          const updatedProductErrors = { ...next[productId] };
          delete updatedProductErrors.buyLink;
          delete updatedProductErrors.bridgePageLink;
          if (Object.keys(updatedProductErrors).length === 0) {
            delete next[productId];
          } else {
            next[productId] = updatedProductErrors;
          }
        }
        return next;
      });
    }

    // Dynamic Validation
    if (value && !isValidUrl(value)) {
      setSiteLinkErrors((prev) => ({
        ...prev,
        [productId]: {
          ...(prev[productId] || {}),
          [field]: "Must start with http:// or https:// and be a valid URL",
        },
      }));
    } else {
      setSiteLinkErrors((prev) => {
        const next = { ...prev };
        if (next[productId]) {
          const updatedProductErrors = { ...next[productId] };
          delete updatedProductErrors[field];
          if (Object.keys(updatedProductErrors).length === 0) {
            delete next[productId];
          } else {
            next[productId] = updatedProductErrors;
          }
        }
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedProductName || !affiliateName || !affiliateLink) {
      setError("Product Name, Affiliate Name, and Affiliate Link are required.");
      return;
    }

    if (geos.length === 0) {
      setError("At least one GEO must be selected.");
      return;
    }

    if (activeProducts.length === 0) {
      setError("Please select at least one site to add the link to.");
      return;
    }

    if (affiliateLinkError || Object.keys(siteLinkErrors).length > 0) {
      setError("Please fix all URL validation errors before submitting.");
      return;
    }

    if (!isValidUrl(affiliateLink)) {
      setError("Please enter a valid Affiliate Link URL (must start with http:// or https://)");
      return;
    }

    // Validate site links only for selected sites
    for (const p of activeProducts) {
      const links = siteLinks[p.id] || { bridgePageLink: "", buyLink: "" };
      if (links.buyLink && !links.bridgePageLink) {
        setError(`Bridge Page Link is required for ${p.site.name} before a Buy Link can be added.`);
        return;
      }
      if (links.bridgePageLink && !isValidUrl(links.bridgePageLink)) {
        setError(`Please enter a valid Bridge Page Link for ${p.site.name} (must start with http:// or https://)`);
        return;
      }
      if (links.buyLink && !isValidUrl(links.buyLink)) {
        setError(`Please enter a valid Buy Link for ${p.site.name} (must start with http:// or https://)`);
        return;
      }
      if (status === "ACCEPTED" && !links.bridgePageLink) {
        setError(`Bridge Page Link is required for ${p.site.name} before setting status to Accepted.`);
        return;
      }
    }

    setSubmitting(true);
    setError("");

    try {
      const mockUserId = session?.user?.id || 1;

      await Promise.all(
        activeProducts.map((p) => {
          const links = siteLinks[p.id] || { bridgePageLink: "", buyLink: "" };
          return fetch("/api/links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: p.id,
              addedById: mockUserId,
              bridgePageLink: links.bridgePageLink || null,
              buyLink: links.buyLink || null,
              affiliateName,
              affiliateLink,
              geos,
              status,
              linkerRemarks: linkerRemarks || null,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.error || `Failed to add link for ${p.site.name}`);
            }
          });
        })
      );

      toast.success(`Successfully added ${activeProducts.length} link log(s)!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const allSitesSelected = matchingProducts.length > 0 && matchingProducts.every((p) => selectedSites[p.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Add New Link Log
                {activeProducts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    {activeProducts.length} {activeProducts.length === 1 ? "Site" : "Sites"} Configured
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300 font-medium">Configure affiliate links and site-specific landing pages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Product Selection */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/70 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              Product <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedProductName}
              onChange={(e) => setSelectedProductName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs cursor-pointer"
              disabled={loadingProducts || !!preselectedProductId}
            >
              <option value="">Select Product...</option>
              {uniqueProductNames.map((name) => {
                const isUnlinked = products.some((p) => p.name === name && (!p.linkLogs || p.linkLogs.length === 0));
                return (
                  <option key={name} value={name}>
                    {name} {isUnlinked ? "⚠️ (Needs Link Logs)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Section 2: Affiliate Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Affiliate Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Affiliate Name <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddAffiliate(!showAddAffiliate)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  {showAddAffiliate ? "Cancel" : "Add New Affiliate"}
                </button>
              </div>

              {showAddAffiliate && (
                <form onSubmit={handleInlineAddAffiliate} className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-xl flex gap-2">
                  <input
                    type="text"
                    placeholder="New affiliate name..."
                    value={newAffiliateName}
                    onChange={(e) => setNewAffiliateName(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={addingAffiliate || !newAffiliateName.trim()}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {addingAffiliate ? "Saving..." : "Add"}
                  </button>
                </form>
              )}

              <select
                value={affiliateName}
                onChange={(e) => setAffiliateName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs cursor-pointer"
              >
                <option value="">Select Affiliate Name...</option>
                {allAffiliates.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Affiliate Link */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Affiliate Link <span className="text-rose-500">*</span>
                </label>
                {globalSettings.defaultSubId && affiliateLink && !affiliateLink.toLowerCase().includes("subid=") && (
                  <button
                    type="button"
                    onClick={() => {
                      const separator = affiliateLink.includes("?") ? "&" : "?";
                      setAffiliateLink(`${affiliateLink}${separator}subid=${globalSettings.defaultSubId}`);
                      toast.success(`Appended Sub ID (${globalSettings.defaultSubId})`);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-amber-500" /> + Sub ID ({globalSettings.defaultSubId})
                  </button>
                )}
              </div>
              <input
                type="url"
                value={affiliateLink}
                onChange={(e) => {
                  const val = e.target.value;
                  setAffiliateLink(val);
                  if (val && !isValidUrl(val)) {
                    setAffiliateLinkError("Must start with http:// or https:// and be a valid URL");
                  } else {
                    setAffiliateLinkError("");
                  }
                }}
                placeholder="https://..."
                className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm font-medium text-slate-900 focus:outline-none transition-all shadow-2xs ${
                  affiliateLinkError
                    ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/10"
                    : "border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                }`}
              />
              {affiliateLinkError && <p className="text-xs font-semibold text-rose-500">{affiliateLinkError}</p>}
            </div>
          </div>

          {/* Section 3: Configure Site-Specific Links (With Quick Fill Toolbar) */}
          {matchingProducts.length > 0 && (
            <div className="border border-indigo-100 rounded-2xl bg-indigo-50/20 p-4 space-y-4 shadow-2xs">
              {/* Header & Quick Actions Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-indigo-100">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    Configure Site-Specific Links ({activeProducts.length} of {matchingProducts.length} Selected)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Select sites and auto-fill bridge/buy links below
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Select All / Deselect All */}
                  <button
                    type="button"
                    onClick={() => handleSelectAllSites(!allSitesSelected)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {allSitesSelected ? (
                      <>
                        <Square className="w-3.5 h-3.5 text-slate-400" /> Deselect All
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> Select All ({matchingProducts.length})
                      </>
                    )}
                  </button>

                  {/* Auto Fill Links Button */}
                  <button
                    type="button"
                    onClick={handleAutoFillLinks}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                    title="Generate bridge & buy URLs for all selected sites automatically"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Auto-Fill All Links
                  </button>
                </div>
              </div>

              {/* Bulk Buy Link Row */}
              <div className="bg-white p-3 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <Zap className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Fill Common Buy Link:</span>
                  <input
                    type="url"
                    placeholder="Paste buy link or affiliate link..."
                    value={bulkBuyLink}
                    onChange={(e) => setBulkBuyLink(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyBulkBuyLink()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Apply to Selected Sites
                  </button>

                  {affiliateLink && (
                    <button
                      type="button"
                      onClick={() => handleApplyBulkBuyLink(affiliateLink)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="Copy primary affiliate link to all site buy links"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" /> Use Affiliate Link
                    </button>
                  )}
                </div>
              </div>

              {/* Site Search Filter if > 4 sites */}
              {matchingProducts.length > 4 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search sites..."
                    value={siteSearchQuery}
                    onChange={(e) => setSiteSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Site List Area */}
              <div className="max-h-[280px] overflow-y-auto pr-1 space-y-2.5">
                {filteredMatchingProducts.map((p) => {
                  const prodErrors = siteLinkErrors[p.id] || {};
                  const isChecked = !!selectedSites[p.id];
                  const effectiveSubId = p.site.subId || globalSettings.defaultSubId || "";

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isChecked
                          ? "bg-white border-indigo-300 shadow-2xs ring-1 ring-indigo-500/20"
                          : "bg-white/60 border-slate-200/70 opacity-60 hover:opacity-80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSite(p.id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer accent-indigo-600"
                          />
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            {p.site.name}
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              Product ID: #{p.id}
                            </span>
                          </span>
                        </label>

                        {effectiveSubId && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-mono font-bold border border-indigo-100">
                            Sub ID: {effectiveSubId}
                          </span>
                        )}
                      </div>

                      {isChecked && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-2.5 border-t border-slate-100">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                Bridge Page Link
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const slug = slugify(selectedProductName);
                                  const baseBridge = (
                                    p.site?.bridgeUrl ||
                                    globalSettings.defaultBridgeUrl ||
                                    p.site?.url ||
                                    ""
                                  ).trim();
                                  if (baseBridge) {
                                    const cleanBase = baseBridge.replace(/\/+$/, "");
                                    updateSiteLink(p.id, "bridgePageLink", `${cleanBase}/${slug}`);
                                  } else {
                                    toast.error("No base bridge URL defined for site");
                                  }
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3 text-amber-500" /> Auto-fill
                              </button>
                            </div>
                            <input
                              type="url"
                              value={siteLinks[p.id]?.bridgePageLink || ""}
                              onChange={(e) => updateSiteLink(p.id, "bridgePageLink", e.target.value)}
                              placeholder="https://..."
                              className={`w-full px-3 py-1.5 bg-slate-50/70 border rounded-lg text-xs text-slate-900 focus:outline-none transition-all ${
                                prodErrors.bridgePageLink
                                  ? "border-rose-400 focus:ring-1 focus:ring-rose-500 bg-rose-50/10"
                                  : "border-slate-200 focus:border-indigo-500 focus:bg-white"
                              }`}
                            />
                            {prodErrors.bridgePageLink && (
                              <p className="text-[10px] font-semibold text-rose-500 mt-1">{prodErrors.bridgePageLink}</p>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Buy Link</label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const slug = slugify(selectedProductName);
                                    const baseBuy = (p.site?.buyUrl || p.site?.bridgeUrl || p.site?.url || "").trim();
                                    if (baseBuy) {
                                      const cleanBuyBase = baseBuy.replace(/\/+$/, "");
                                      updateSiteLink(p.id, "buyLink", `${cleanBuyBase}/${slug}`);
                                    } else {
                                      toast.error("No base buy URL defined for site");
                                    }
                                  }}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-500" /> Auto-fill
                                </button>
                                {affiliateLink && (
                                  <button
                                    type="button"
                                    onClick={() => updateSiteLink(p.id, "buyLink", affiliateLink)}
                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3 text-slate-400" /> Use Affiliate Link
                                  </button>
                                )}
                              </div>
                            </div>
                            <input
                              type="url"
                              value={siteLinks[p.id]?.buyLink || ""}
                              onChange={(e) => updateSiteLink(p.id, "buyLink", e.target.value)}
                              placeholder={siteLinks[p.id]?.bridgePageLink ? "https://..." : "Add bridge page first"}
                              disabled={!siteLinks[p.id]?.bridgePageLink}
                              className={`w-full px-3 py-1.5 bg-slate-50/70 border rounded-lg text-xs text-slate-900 focus:outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400 ${
                                prodErrors.buyLink
                                  ? "border-rose-400 focus:ring-1 focus:ring-rose-500 bg-rose-50/10"
                                  : "border-slate-200 focus:border-indigo-500 focus:bg-white"
                              }`}
                            />
                            {prodErrors.buyLink && (
                              <p className="text-[10px] font-semibold text-rose-500 mt-1">{prodErrors.buyLink}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Geos Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                Target GEOs <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGeos([...allGeos])}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setGeos([])}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {geos.length === 0 && (
              <p className="text-xs text-rose-500 font-semibold">At least one GEO is required.</p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {allGeos.map((geo) => {
                const isSelected = geos.includes(geo);
                return (
                  <button
                    key={geo}
                    type="button"
                    onClick={() => toggleGeo(geo)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-2xs border border-indigo-600"
                        : "bg-white text-slate-700 border border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{geo}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 5: Link Status & Remarks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Link Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs cursor-pointer"
              >
                {LINK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Remarks
              </label>
              <textarea
                rows={2}
                value={linkerRemarks}
                onChange={(e) => setLinkerRemarks(e.target.value)}
                placeholder="Any issues or extra notes..."
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs resize-none"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-500">
            {activeProducts.length > 0 ? (
              <span className="text-indigo-600 font-bold">
                {activeProducts.length} link log {activeProducts.length === 1 ? "entry" : "entries"} will be created
              </span>
            ) : (
              <span>Select at least one site above</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-white transition text-xs cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || activeProducts.length === 0}
              type="button"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-indigo-200 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              {submitting ? "Saving..." : `Add ${activeProducts.length} Link Log(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
