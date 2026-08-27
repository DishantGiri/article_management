"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import FormattedRemarks from "@/components/FormattedRemarks";
import CustomSelect from "@/components/CustomSelect";

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
    } catch (err: any) {
      setError(err.message || "Failed to add affiliate");
    } finally {
      setAddingAffiliate(false);
    }
  };

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
      setLinkerRemarks(cleanRemarks);
      setGeos(link.geos?.map((g) => g.geo) || []);



      fetch("/api/affiliates")
        .then(r => r.json())
        .then(data => { setDbAffiliates(Array.isArray(data) ? data : []); })
        .catch(e => console.error("Failed to load affiliates", e));

      fetch("/api/geos")
        .then(r => r.json())
        .then(data => { setDbGeos(Array.isArray(data) ? data.map((g: any) => g.code) : []); })
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
  }, [isOpen, link]);

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

    // Fix 1: Compulsory Geo selection
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
      setError("Bridge Page Link is required before a Buy Link can be added.");
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden border border-[#CBCBCB]/60">
        <div className="px-6 py-4 bg-[#4A4A4A] text-white flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Edit Link Log</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition cursor-pointer">
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

          {link.status === "ISSUE" && link.linkerRemarks && (
            <div className="mb-2">
              <FormattedRemarks remarks={link.linkerRemarks} />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Product *</label>
            <CustomSelect
              value={productId}
              onChange={(val) => setProductId(val)}
              placeholder="Select Product..."
              disabled={loadingProducts}
              options={products.map((p) => ({
                value: String(p.id),
                label: `${p.name} (${p.site.name})`
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase">Affiliate Name *</label>
                <button
                  type="button"
                  onClick={() => setShowAddAffiliate(!showAddAffiliate)}
                  className="text-[10px] font-bold text-[#6D8196] hover:text-[#4A4A4A] underline cursor-pointer"
                >
                  {showAddAffiliate ? "Cancel" : "+ Add Affiliate"}
                </button>
              </div>

              {showAddAffiliate && (
                <form onSubmit={handleInlineAddAffiliate} className="mb-2 p-2 bg-[#FAF9F5] border border-[#CBCBCB] rounded-lg flex gap-2">
                  <input
                    type="text"
                    placeholder="New affiliate name..."
                    value={newAffiliateName}
                    onChange={(e) => setNewAffiliateName(e.target.value)}
                    className="flex-1 px-2.5 py-1 bg-white border border-[#CBCBCB] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#6D8196]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={addingAffiliate || !newAffiliateName.trim()}
                    className="px-3 py-1 bg-[#6D8196] text-white rounded text-xs font-semibold hover:bg-[#5A6D81] disabled:opacity-50 transition cursor-pointer"
                  >
                    {addingAffiliate ? "..." : "Add"}
                  </button>
                </form>
              )}

              <CustomSelect
                value={affiliateName}
                onChange={(val) => setAffiliateName(val)}
                placeholder="Select Affiliate Name..."
                options={allAffiliates.map((name) => ({ value: name, label: name }))}
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
                  if (!val) {
                    setBuyLink(""); // Clear buy link if bridge page is cleared
                  }
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
                disabled={!bridgePageLink}
                onChange={(e) => {
                  const val = e.target.value;
                  setBuyLink(val);
                  if (val && !isValidUrl(val)) {
                    setBuyLinkError("Must start with http:// or https:// and be a valid URL");
                  } else {
                    setBuyLinkError("");
                  }
                }}
                placeholder={bridgePageLink ? "https://..." : "Add bridge page first"}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none transition-colors disabled:bg-slate-100 disabled:text-slate-400 ${
                  buyLinkError ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-indigo-500"
                }`}
              />
              {buyLinkError && (
                <p className="text-[11px] font-semibold text-rose-500 mt-1">{buyLinkError}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
              Geos (Multi-select) <span className="text-rose-500">*</span>
            </label>
            {geos.length === 0 && (
              <p className="text-[10px] text-rose-500 font-semibold mb-1.5">At least one GEO is required.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {allGeos.map((geo) => (
                <button
                  key={geo}
                  type="button"
                  onClick={() => toggleGeo(geo)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    geos.includes(geo)
                      ? "bg-[#6D8196] text-white border border-[#6D8196]"
                      : "bg-white text-[#4A4A4A] border border-[#CBCBCB] hover:border-[#6D8196] hover:bg-[#FAF9F5]"
                  }`}
                >
                  {geo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Link Status</label>
            <CustomSelect
              value={status}
              onChange={(val) => setStatus(val)}
              placeholder="Select Link Status..."
              options={LINK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Remarks</label>
            <textarea
              rows={2}
              value={linkerRemarks}
              onChange={(e) => setLinkerRemarks(e.target.value)}
              placeholder="Any issues or notes..."
              className="w-full px-3 py-2 bg-white border border-[#CBCBCB] rounded-lg text-sm text-[#4A4A4A] focus:outline-none focus:border-[#6D8196] transition-colors resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#CBCBCB]/40">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-lg border border-[#CBCBCB] text-[#4A4A4A] font-semibold hover:bg-[#FAF9F5] transition text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !isFormValid}
              type="button"
              title={!isFormValid ? "Please fill in all required fields: Affiliate Name, Affiliate Link, and at least one GEO" : undefined}
              className="px-4 py-2 rounded-lg bg-[#6D8196] text-white font-semibold hover:bg-[#5A6D81] disabled:opacity-40 disabled:cursor-not-allowed transition text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
