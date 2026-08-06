"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import {
  Sparkles,
  Copy,
  Plus,
  Building2,
  Link2,
  Check,
  AlertCircle,
  Tag,
  Globe,
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  linkLogs?: any[];
  site: {
    id: number;
    name: string;
    url?: string | null;
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
  const [affiliateName, setAffiliateName] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [geos, setGeos] = useState<string[]>([]);
  const [status, setStatus] = useState("REQUESTED");
  const [linkerRemarks, setLinkerRemarks] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [affiliateLinkError, setAffiliateLinkError] = useState("");
  const [bridgeLinkError, setBridgeLinkError] = useState("");
  const [buyLinkError, setBuyLinkError] = useState("");

  const [dbAffiliates, setDbAffiliates] = useState<DbAffiliate[]>([]);
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

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const selectedAffiliateObj = useMemo(
    () => dbAffiliates.find((a) => a.name === affiliateName),
    [dbAffiliates, affiliateName]
  );

  const allAffiliates = useMemo(() => dbAffiliates.map((a) => a.name), [dbAffiliates]);
  const allGeos = dbGeos;

  useEffect(() => {
    if (isOpen) {
      fetch("/api/affiliates")
        .then((r) => r.json())
        .then((data) => setDbAffiliates(Array.isArray(data) ? data : []))
        .catch((e) => console.error("Failed to load affiliates", e));

      fetch("/api/geos")
        .then((r) => r.json())
        .then((data) => setDbGeos(Array.isArray(data) ? data.map((g: any) => g.code) : []))
        .catch((e) => console.error("Failed to load geos", e));

      setSelectedProductId(null);
      setBridgePageLink("");
      setBuyLink("");
      setAffiliateName("");
      setAffiliateLink("");
      setGeos([]);
      setStatus("REQUESTED");
      setLinkerRemarks("");
      setError("");
      setAffiliateLinkError("");
      setBridgeLinkError("");
      setBuyLinkError("");

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
              setSelectedProductId(found.id);
            }
          }
        })
        .catch(() => setError("Failed to load products"))
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, preselectedProductId, session?.user?.id]);

  // Reset link inputs when product selection changes
  useEffect(() => {
    setBridgePageLink("");
    setBuyLink("");
    setBridgeLinkError("");
    setBuyLinkError("");
  }, [selectedProductId]);

  const toggleGeo = (geo: string) => {
    setGeos((prev) => (prev.includes(geo) ? prev.filter((g) => g !== geo) : [...prev, geo]));
  };

  // All required fields must be filled before enabling submit
  const isFormValid =
    !!selectedProductId &&
    !!affiliateName.trim() &&
    !!affiliateLink.trim() &&
    isValidUrl(affiliateLink) &&
    !affiliateLinkError &&
    !bridgeLinkError &&
    !buyLinkError &&
    geos.length > 0;

  const handleSubmit = async () => {
    if (!selectedProductId || !selectedProduct) {
      setError("Product is required.");
      return;
    }

    if (!affiliateName || !affiliateLink) {
      setError("Affiliate Name and Affiliate Link are required.");
      return;
    }

    if (geos.length === 0) {
      setError("At least one GEO must be selected.");
      return;
    }

    if (affiliateLinkError || bridgeLinkError || buyLinkError) {
      setError("Please fix all URL validation errors before submitting.");
      return;
    }

    if (!isValidUrl(affiliateLink)) {
      setError("Please enter a valid Affiliate Link URL (must start with http:// or https://)");
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

    if (status === "ACCEPTED" && !bridgePageLink) {
      setError(`Bridge Page Link is required before setting status to Accepted.`);
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
          affiliateName,
          affiliateLink,
          geos,
          status,
          linkerRemarks: linkerRemarks || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add link");
      }

      toast.success(`Successfully added link log!`);
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Add New Link Log
                {selectedProduct && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Site: {selectedProduct.site?.name}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                Configure affiliate links and site-specific landing pages
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
              value={selectedProductId || ""}
              onChange={(e) => setSelectedProductId(Number(e.target.value) || null)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs cursor-pointer"
              disabled={loadingProducts || !!preselectedProductId}
            >
              <option value="">Select Product...</option>
              {products.map((p) => {
                const isUnlinked = !p.linkLogs || p.linkLogs.length === 0;
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} — (Site: {p.site?.name || "Unassigned"}) {isUnlinked ? "⚠️ (Needs Link Logs)" : ""}
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
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Affiliate Link <span className="text-rose-500">*</span>
              </label>
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

          {/* Section 3: Configure Site-Specific Link (Only Selected Product's Site) */}
          {selectedProduct && (
            <div className="border border-indigo-100 rounded-2xl bg-indigo-50/20 p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Site: <span className="text-indigo-600">{selectedProduct.site?.name}</span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Product ID: #{selectedProduct.id}
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Bridge Page Link
                  </label>
                  <input
                    type="url"
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
                    placeholder="Enter bridge page URL manually..."
                    className={`w-full px-3.5 py-2 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none transition-all ${
                      bridgeLinkError
                        ? "border-rose-400 focus:ring-1 focus:ring-rose-500 bg-rose-50/10"
                        : "border-slate-200 focus:border-indigo-500"
                    }`}
                  />
                  {bridgeLinkError && (
                    <p className="text-[10px] font-semibold text-rose-500 mt-1">{bridgeLinkError}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      Buy Link
                    </label>
                    {affiliateLink && (
                      <button
                        type="button"
                        onClick={() => setBuyLink(affiliateLink)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-slate-400" /> Use Affiliate Link
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={buyLink}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBuyLink(val);
                      if (val && !isValidUrl(val)) {
                        setBuyLinkError("Must start with http:// or https://");
                      } else {
                        setBuyLinkError("");
                      }
                    }}
                    placeholder={bridgePageLink ? "Enter buy URL manually..." : "Add bridge page link first"}
                    disabled={!bridgePageLink}
                    className={`w-full px-3.5 py-2 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400 ${
                      buyLinkError
                        ? "border-rose-400 focus:ring-1 focus:ring-rose-500 bg-rose-50/10"
                        : "border-slate-200 focus:border-indigo-500"
                    }`}
                  />
                  {buyLinkError && (
                    <p className="text-[10px] font-semibold text-rose-500 mt-1">{buyLinkError}</p>
                  )}
                </div>
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
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs font-semibold text-slate-500">
            {selectedProduct ? (
              <span className="text-indigo-600 font-bold">
                1 link log entry will be created for {selectedProduct.site?.name}
              </span>
            ) : (
              <span>Select a product above</span>
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
              disabled={submitting || !isFormValid}
              type="button"
              title={!isFormValid ? "Please fill in all required fields: Product, Affiliate Name, Affiliate Link, and at least one GEO" : undefined}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {submitting ? "Saving..." : "Add 1 Link Log"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
