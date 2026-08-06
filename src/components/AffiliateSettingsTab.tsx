"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
  Search,
  Lock,
  Sparkles,
  Link2,
} from "lucide-react";
import { toast } from "react-hot-toast";

export interface AffiliateItem {
  id: number;
  name: string;
  defaultUrl?: string | null;
  subIdPattern?: string | null;
  createdAt: string;
}

export default function AffiliateSettingsTab() {
  const { data: session } = useSession();
  const [affiliates, setAffiliates] = useState<AffiliateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // New Affiliate Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSubIdPattern, setNewSubIdPattern] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit Inline State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editSubIdPattern, setEditSubIdPattern] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const userRole = session?.user?.role || "WRITER";
  const canManage =
    userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "LINKER";

  const fetchAffiliates = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/affiliates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load affiliates");
      setAffiliates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load affiliates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAffiliates();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Affiliate Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          defaultUrl: newUrl.trim() || null,
          subIdPattern: newSubIdPattern.trim() || null,
          callerId: session?.user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create affiliate");

      toast.success(`Affiliate "${newName.trim()}" saved!`);
      setNewName("");
      setNewUrl("");
      setNewSubIdPattern("");
      setShowAddForm(false);
      await fetchAffiliates();
    } catch (err: any) {
      toast.error(err.message || "Failed to save affiliate");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: AffiliateItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditUrl(item.defaultUrl || "");
    setEditSubIdPattern(item.subIdPattern || "");
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) {
      toast.error("Affiliate Name is required.");
      return;
    }
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/affiliates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          defaultUrl: editUrl.trim() || null,
          subIdPattern: editSubIdPattern.trim() || null,
          callerId: session?.user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update affiliate");

      toast.success("Affiliate updated!");
      setEditingId(null);
      await fetchAffiliates();
    } catch (err: any) {
      toast.error(err.message || "Failed to update affiliate");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/affiliates/${id}?callerId=${session?.user?.id || 1}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete");
      }
      toast.success(`"${name}" deleted.`);
      setAffiliates((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAffiliates = affiliates.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.defaultUrl && a.defaultUrl.toLowerCase().includes(q)) ||
      (a.subIdPattern && a.subIdPattern.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Affiliate Networks & Sub ID Settings
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <Lock className="w-3 h-3 text-indigo-500" /> Admins & Linkers Only
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage affiliate networks, base URLs, and Sub ID query parameters (e.g. <code className="text-indigo-600 bg-slate-100 px-1 rounded">subid</code>, <code className="text-indigo-600 bg-slate-100 px-1 rounded">sub1</code>, <code className="text-indigo-600 bg-slate-100 px-1 rounded">aff_sub1</code>)
              </p>
            </div>
          </div>

          {canManage && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            >
              {showAddForm ? (
                <>
                  <X className="w-4 h-4" /> Cancel
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add Affiliate Network
                </>
              )}
            </button>
          )}
        </div>

        {/* Add Form */}
        {showAddForm && canManage && (
          <form
            onSubmit={handleCreate}
            className="p-4 bg-slate-50 border border-indigo-100 rounded-xl space-y-3 animate-fadeIn"
          >
            <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" /> New Affiliate Network
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Affiliate Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. BuyGoods"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Base Tracking URL
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://chocotide.com/cho-aff-buy-dtc/?aff_id=779&subid=dhs"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Sub ID Parameter / Pattern
                </label>
                <input
                  type="text"
                  value={newSubIdPattern}
                  onChange={(e) => setNewSubIdPattern(e.target.value)}
                  placeholder="aff_id=779&subid=dhs"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !newName.trim()}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
              >
                {submitting ? "Saving..." : "Save Network"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search affiliate networks or Sub IDs..."
          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
        />
      </div>

      {/* Affiliates List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-500">
            Loading affiliate settings...
          </div>
        ) : filteredAffiliates.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 italic">
            No affiliate networks found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Affiliate Name</th>
                  <th className="px-4 py-3">Base Tracking URL</th>
                  <th className="px-4 py-3">Sub ID Parameters</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAffiliates.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      {isEditing ? (
                        <>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="url"
                              value={editUrl}
                              onChange={(e) => setEditUrl(e.target.value)}
                              placeholder="Base URL"
                              className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-medium text-slate-900"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editSubIdPattern}
                              onChange={(e) => setEditSubIdPattern(e.target.value)}
                              placeholder="Sub ID parameters e.g. sub1=dhs&sub2=dhs2"
                              className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-medium text-slate-900"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleUpdate(item.id)}
                                disabled={updatingId === item.id}
                                className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                              <span>{item.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 max-w-xs truncate">
                            {item.defaultUrl ? (
                              <a
                                href={item.defaultUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline flex items-center gap-1 font-mono text-[11px] truncate"
                                title={item.defaultUrl}
                              >
                                <Link2 className="w-3 h-3 shrink-0 opacity-60" />
                                {item.defaultUrl}
                              </a>
                            ) : (
                              <span className="text-slate-400 italic">Not set</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {item.subIdPattern ? (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[11px] font-semibold border border-indigo-100">
                                {item.subIdPattern}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">No Sub ID pattern</span>
                            )}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => startEdit(item)}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition cursor-pointer"
                                  title="Edit Affiliate & Sub ID"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id, item.name)}
                                  disabled={deletingId === item.id}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                                  title="Delete Affiliate"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
