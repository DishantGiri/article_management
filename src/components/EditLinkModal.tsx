"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Product {
  id: number;
  name: string;
  site: { name: string };
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

export default function EditLinkModal({ isOpen, onClose, onSuccess, link }: EditLinkModalProps) {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
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

  useEffect(() => {
    if (isOpen && link) {
      setProductId(link.productId?.toString() || "");
      setAffiliateName(link.affiliateName || "");
      setAffiliateLink(link.affiliateLink || "");
      setBridgePageLink(link.bridgePageLink || "");
      setBuyLink(link.buyLink || "");
      setStatus(link.status || "REQUESTED");
      setLinkerRemarks(link.linkerRemarks || "");
      setGeos(link.geos?.map((g) => g.geo) || []);

      setError("");
      setAffiliateLinkError("");
      setBridgePageLinkError("");
      setBuyLinkError("");

      const mockUserId = session?.user?.id || 1;
      setLoadingProducts(true);
      fetch(`/api/products?userId=${mockUserId}`)
        .then((r) => r.json())
        .then((data) => {
          setProducts(Array.isArray(data) ? data : []);
        })
        .catch(() => setError("Failed to load products"))
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, link]);

  const toggleGeo = (geo: string) => {
    setGeos((prev) => (prev.includes(geo) ? prev.filter((g) => g !== geo) : [...prev, geo]));
  };

  const handleSubmit = async () => {
    if (!link) return;

    if (!productId || !affiliateName || !affiliateLink) {
      setError("Product, Affiliate Name, and Affiliate Link are required.");
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

    if (status === "ACCEPTED" && !bridgePageLink) {
      setError("Bridge Page Link is required before setting status to Accepted.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const mockUserId = session?.user?.id || 1;
      const res = await fetch(`/api/links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: parseInt(productId),
          affiliateName,
          affiliateLink,
          bridgePageLink: bridgePageLink || null,
          buyLink: buyLink || null,
          status,
          linkerRemarks: linkerRemarks || null,
          geos,
          callerId: mockUserId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update link log");
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !link) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Edit Link Log</h2>
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
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              disabled={loadingProducts}
            >
              <option value="">Select Product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.site.name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Affiliate Name *</label>
              <input
                type="text"
                value={affiliateName}
                onChange={(e) => setAffiliateName(e.target.value)}
                placeholder="e.g. Amazon, ClickBank"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Affiliate Link *</label>
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
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none transition-colors ${
                  affiliateLinkError ? "border-rose-400 focus:border-rose-500 bg-rose-50/10" : "border-slate-200 focus:border-indigo-500"
                }`}
              />
              {affiliateLinkError && (
                <p className="text-[11px] font-semibold text-rose-500 mt-1">{affiliateLinkError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Bridge Page Link</label>
              <input
                type="url"
                value={bridgePageLink}
                onChange={(e) => {
                  const val = e.target.value;
                  setBridgePageLink(val);
                  if (val && !isValidUrl(val)) {
                    setBridgePageLinkError("Must start with http:// or https:// and be a valid URL");
                  } else {
                    setBridgePageLinkError("");
                  }
                }}
                placeholder="https://..."
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none transition-colors ${
                  bridgePageLinkError ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"
                }`}
              />
              {bridgePageLinkError && (
                <p className="text-[11px] font-semibold text-rose-500 mt-1">{bridgePageLinkError}</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Buy Link</label>
              <input
                type="url"
                value={buyLink}
                onChange={(e) => {
                  const val = e.target.value;
                  setBuyLink(val);
                  if (val && !isValidUrl(val)) {
                    setBuyLinkError("Must start with http:// or https:// and be a valid URL");
                  } else {
                    setBuyLinkError("");
                  }
                }}
                placeholder="https://..."
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none transition-colors ${
                  buyLinkError ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"
                }`}
              />
              {buyLinkError && (
                <p className="text-[11px] font-semibold text-rose-500 mt-1">{buyLinkError}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Geos (Multi-select)</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_GEOS.map((geo) => (
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
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              {LINK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Remarks</label>
            <textarea
              rows={2}
              value={linkerRemarks}
              onChange={(e) => setLinkerRemarks(e.target.value)}
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
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
