"use client";

import { useState, useEffect } from "react";

interface Product {
  id: number;
  name: string;
  site: { name: string };
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

const COMMON_GEOS = ["US", "UK", "CA", "AU", "DE", "FR", "GLOBAL"];

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

export default function AddLinkModal({ isOpen, onClose, onSuccess, preselectedProductId }: AddLinkModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  const [selectedProductName, setSelectedProductName] = useState<string>("");
  const [siteLinks, setSiteLinks] = useState<Record<number, { bridgePageLink: string; buyLink: string }>>({});
  const [affiliateName, setAffiliateName] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [geos, setGeos] = useState<string[]>([]);
  const [status, setStatus] = useState("REQUESTED");
  const [linkerRemarks, setLinkerRemarks] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [affiliateLinkError, setAffiliateLinkError] = useState("");
  const [siteLinkErrors, setSiteLinkErrors] = useState<Record<string, { bridgePageLink?: string; buyLink?: string }>>({});

  // Get unique product names for the dropdown list
  const uniqueProductNames = Array.from(new Set(products.map((p) => p.name)));

  // Get matching products for the selected product name
  const matchingProducts = products.filter((p) => p.name === selectedProductName);

  useEffect(() => {
    if (isOpen) {
      setSelectedProductName("");
      setSiteLinks({});
      setAffiliateName("");
      setAffiliateLink("");
      setGeos([]);
      setStatus("REQUESTED");
      setLinkerRemarks("");
      setError("");
      setAffiliateLinkError("");
      setSiteLinkErrors({});
      
      const mockUserId = typeof window !== "undefined" ? localStorage.getItem("mockUserId") || "1" : "1";
      setLoadingProducts(true);
      fetch(`/api/products?userId=${mockUserId}`)
        .then(r => r.json())
        .then(data => {
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
  }, [isOpen, preselectedProductId]);

  // When selected product name changes, initialize the inputs for all its sites
  useEffect(() => {
    const matching = products.filter((p) => p.name === selectedProductName);
    const initialInputs: Record<number, { bridgePageLink: string; buyLink: string }> = {};
    matching.forEach((p) => {
      initialInputs[p.id] = { bridgePageLink: "", buyLink: "" };
    });
    setSiteLinks(initialInputs);
    setSiteLinkErrors({});
  }, [selectedProductName, products]);

  const toggleGeo = (geo: string) => {
    setGeos(prev => prev.includes(geo) ? prev.filter(g => g !== geo) : [...prev, geo]);
  };

  const updateSiteLink = (productId: number, field: "bridgePageLink" | "buyLink", value: string) => {
    setSiteLinks((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { bridgePageLink: "", buyLink: "" }),
        [field]: value,
      },
    }));

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

    if (affiliateLinkError || Object.keys(siteLinkErrors).length > 0) {
      setError("Please fix all URL validation errors before submitting.");
      return;
    }

    if (!isValidUrl(affiliateLink)) {
      setError("Please enter a valid Affiliate Link URL (must start with http:// or https://)");
      return;
    }
    
    // Validate site links
    for (const p of matchingProducts) {
      const links = siteLinks[p.id] || { bridgePageLink: "", buyLink: "" };
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
      const mockUserId = typeof window !== "undefined" ? localStorage.getItem("mockUserId") || "1" : "1";
      
      // Save link log for each matching site in parallel
      await Promise.all(
        matchingProducts.map((p) => {
          const links = siteLinks[p.id] || { bridgePageLink: "", buyLink: "" };
          return fetch("/api/links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: p.id,
              addedById: parseInt(mockUserId),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Add New Link Log</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <span className="font-bold">!</span> {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Product *</label>
            <select
              value={selectedProductName}
              onChange={e => setSelectedProductName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
              disabled={loadingProducts || !!preselectedProductId}
            >
              <option value="">Select Product...</option>
              {uniqueProductNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Affiliate Name *</label>
              <input
                type="text"
                value={affiliateName}
                onChange={e => setAffiliateName(e.target.value)}
                placeholder="e.g. Amazon, ClickBank"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Affiliate Link *</label>
              <input
                type="url"
                value={affiliateLink}
                onChange={e => {
                  const val = e.target.value;
                  setAffiliateLink(val);
                  if (val && !isValidUrl(val)) {
                    setAffiliateLinkError("Must start with http:// or https:// and be a valid URL");
                  } else {
                    setAffiliateLinkError("");
                  }
                }}
                placeholder="https://..."
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none transition-colors ${
                  affiliateLinkError
                    ? "border-rose-400 focus:border-rose-500 bg-rose-50/10"
                    : "border-slate-200 focus:border-indigo-500"
                }`}
              />
              {affiliateLinkError && (
                <p className="text-[11px] font-semibold text-rose-500 mt-1">{affiliateLinkError}</p>
              )}
            </div>
          </div>

          {matchingProducts.length > 0 && (
            <div className="space-y-3">
              <label className="block text-[11px] font-bold text-slate-500 uppercase">Configure Site-Specific Links</label>
              {matchingProducts.map((p) => {
                const prodErrors = siteLinkErrors[p.id] || {};
                return (
                  <div key={p.id} className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-700">{p.site.name}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Product ID: {p.id}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bridge Page Link</label>
                        <input
                          type="url"
                          value={siteLinks[p.id]?.bridgePageLink || ""}
                          onChange={e => updateSiteLink(p.id, "bridgePageLink", e.target.value)}
                          placeholder="https://..."
                          className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs text-slate-900 focus:outline-none transition-colors ${
                            prodErrors.bridgePageLink
                              ? "border-rose-400 focus:border-rose-500 bg-rose-50/10"
                              : "border-slate-200 focus:border-indigo-500"
                          }`}
                        />
                        {prodErrors.bridgePageLink && (
                          <p className="text-[10px] font-semibold text-rose-500 mt-1">{prodErrors.bridgePageLink}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Buy Link</label>
                        <input
                          type="url"
                          value={siteLinks[p.id]?.buyLink || ""}
                          onChange={e => updateSiteLink(p.id, "buyLink", e.target.value)}
                          placeholder="https://..."
                          className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs text-slate-900 focus:outline-none transition-colors ${
                            prodErrors.buyLink
                              ? "border-rose-400 focus:border-rose-500 bg-rose-50/10"
                              : "border-slate-200 focus:border-indigo-500"
                          }`}
                        />
                        {prodErrors.buyLink && (
                          <p className="text-[10px] font-semibold text-rose-500 mt-1">{prodErrors.buyLink}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Geos (Multi-select)</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_GEOS.map(geo => (
                <button
                  key={geo}
                  type="button"
                  onClick={() => toggleGeo(geo)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    geos.includes(geo)
                      ? "bg-indigo-500 text-white border border-indigo-600"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                  }`}
                >
                  {geo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Link Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {LINK_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Remarks</label>
            <textarea
              rows={2}
              value={linkerRemarks}
              onChange={e => setLinkerRemarks(e.target.value)}
              placeholder="Any issues or notes..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              type="button"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition text-sm flex items-center justify-center gap-2"
            >
              {submitting ? "Saving..." : "Add Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
