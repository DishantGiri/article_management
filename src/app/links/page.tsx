"use client";

import { useEffect, useState } from "react";

const ALL_GEOS = ["US", "UK", "CA", "AU", "IN", "DE", "FR", "NZ", "ZA", "IE", "SG", "AE", "NL", "SE", "NO"];
const LINK_STATUSES = ["REQUESTED", "ACCEPTED", "CANCELED", "ISSUE", "NEED_TO_CHECK", "PRESELL_PAGE", "REDIRECTED"];

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-red-100 text-red-700",
  ISSUE: "bg-orange-100 text-orange-700",
  NEED_TO_CHECK: "bg-amber-100 text-amber-700",
  PRESELL_PAGE: "bg-purple-100 text-purple-700",
  REDIRECTED: "bg-cyan-100 text-cyan-700",
};

interface LinkLog {
  id: number;
  affiliateName: string;
  affiliateLink: string;
  bridgePageLink?: string;
  buyLink?: string;
  status: string;
  linkerRemarks?: string;
  addedAt: string;
  updatedAt: string;
  geos: { geo: string }[];
  addedBy: { name: string };
  product: { name: string };
}

interface Product { id: number; name: string; productType: string; }

export default function LinksPage() {
  const [links, setLinks] = useState<LinkLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [editingStatus, setEditingStatus] = useState<{ id: number; status: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    productId: "",
    bridgePageLink: "",
    buyLink: "",
    affiliateName: "",
    affiliateLink: "",
    geos: [] as string[],
    status: "REQUESTED",
    linkerRemarks: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem("mockUserId");
    setCurrentUserId(parseInt(stored || "2"));
    Promise.all([
      fetch("/api/links").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([linksData, productsData]) => {
      setLinks(linksData);
      setProducts(productsData);
    }).finally(() => setLoading(false));
  }, []);

  const toggleGeo = (geo: string) => {
    setForm((prev) => ({
      ...prev,
      geos: prev.geos.includes(geo) ? prev.geos.filter((g) => g !== geo) : [...prev.geos, geo],
    }));
  };

  const submitLink = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, addedById: currentUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinks((prev) => [data, ...prev]);
      setShowForm(false);
      setForm({ productId: "", bridgePageLink: "", buyLink: "", affiliateName: "", affiliateLink: "", geos: [], status: "REQUESTED", linkerRemarks: "" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save link");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
    setEditingStatus(null);
  };

  const filtered = statusFilter ? links.filter((l) => l.status === statusFilter) : links;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Link Management</h1>
          <p className="text-gray-500 mt-1">{links.length} link entries across all products</p>
        </div>
        <button
          id="btn-add-link"
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Link
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["", ...LINK_STATUSES].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === s ? "bg-violet-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-violet-300"
            }`}>
            {s === "" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Add Link Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">Add Affiliate Link</h2>
              <button onClick={() => { setShowForm(false); setError(""); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Product <span className="text-red-500">*</span></label>
                <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="">Select product</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.productType})</option>)}
                </select>
              </div>

              {[
                { label: "Bridge Page Link", key: "bridgePageLink", placeholder: "https://bridge.example.com" },
                { label: "Buy Link", key: "buyLink", placeholder: "https://buy.example.com" },
                { label: "Affiliate Name *", key: "affiliateName", placeholder: "e.g. ClickBank, ShareASale" },
                { label: "Affiliate Link *", key: "affiliateLink", placeholder: "https://affiliate.example.com/ref=..." },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                  <input type="text" placeholder={placeholder}
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              ))}

              {/* GEO Multi-select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">GEOs (multi-select)</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_GEOS.map((g) => (
                    <button key={g} type="button" onClick={() => toggleGeo(g)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                        form.geos.includes(g) ? "bg-violet-600 border-violet-600 text-white" : "border-gray-300 text-gray-600 hover:border-violet-400"
                      }`}>{g}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Link Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  {LINK_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Linker Remarks</label>
                <textarea rows={2} placeholder="Optional notes…"
                  value={form.linkerRemarks}
                  onChange={(e) => setForm({ ...form, linkerRemarks: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button id="btn-submit-link" onClick={submitLink} disabled={saving || !form.affiliateName || !form.affiliateLink || !form.productId}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 transition">
                  {saving ? "Saving…" : "Add Link"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link List */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          No links found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => (
            <div key={l.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800">{l.affiliateName}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[l.status] || "bg-gray-100 text-gray-600"}`}>
                      {l.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{l.product.name} · Added by {l.addedBy.name}</p>
                  <div className="space-y-1 text-xs">
                    {l.bridgePageLink && <p className="text-gray-500">🔗 Bridge: <a href={l.bridgePageLink} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline truncate">{l.bridgePageLink}</a></p>}
                    {l.buyLink && <p className="text-gray-500">🛒 Buy: <a href={l.buyLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{l.buyLink}</a></p>}
                    <p className="text-gray-500">📎 Affiliate: <a href={l.affiliateLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">{l.affiliateLink}</a></p>
                  </div>
                  {l.geos.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {l.geos.map((g) => <span key={g.geo} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-gray-600">{g.geo}</span>)}
                    </div>
                  )}
                  {l.linkerRemarks && <p className="text-xs text-gray-400 mt-2 italic">{l.linkerRemarks}</p>}
                </div>

                {/* Status Updater */}
                <div className="flex-shrink-0">
                  {editingStatus?.id === l.id ? (
                    <div className="flex flex-col gap-1.5 w-36">
                      <select
                        value={editingStatus.status}
                        onChange={(e) => setEditingStatus({ id: l.id, status: e.target.value })}
                        className="px-2 py-1.5 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 w-full"
                      >
                        {LINK_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                      <div className="flex gap-1">
                        <button onClick={() => updateStatus(l.id, editingStatus.status)}
                          className="flex-1 py-1 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-700">Save</button>
                        <button onClick={() => setEditingStatus(null)}
                          className="flex-1 py-1 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50">✕</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setEditingStatus({ id: l.id, status: l.status })}
                      className="text-xs text-gray-400 hover:text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50 transition">
                      Update Status
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
