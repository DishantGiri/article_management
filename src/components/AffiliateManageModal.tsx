"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, Tag } from "lucide-react";
import { toast } from "react-hot-toast";

interface Affiliate {
  id: number;
  name: string;
  createdAt: string;
}

interface AffiliateManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AffiliateManageModal({ isOpen, onClose }: AffiliateManageModalProps) {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fetchAffiliates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates");
      const data = await res.json();
      setAffiliates(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load affiliates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setNewName("");
      setError("");
      fetchAffiliates();
    }
  }, [isOpen]);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Please enter an affiliate name.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add affiliate.");
        return;
      }
      toast.success(`"${trimmed}" added!`);
      setNewName("");
      await fetchAffiliates();
    } catch {
      setError("Something went wrong.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete affiliate "${name}"? This will not remove it from existing link logs.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/affiliates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Failed to delete affiliate.");
        return;
      }
      toast.success(`"${name}" removed.`);
      setAffiliates((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Tag className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Manage Affiliates</h2>
              <p className="text-xs text-slate-400 font-medium">{affiliates.length} saved names</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add New */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2 tracking-wide">
            Add New Affiliate Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !adding && handleAdd()}
              placeholder="e.g. ClickBank, Commission Junction..."
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-rose-500 font-medium">{error}</p>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-400">Loading...</p>
            </div>
          ) : affiliates.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Tag className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">No affiliates yet</p>
              <p className="text-xs text-slate-400 mt-1">Add your first affiliate name above.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {affiliates.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-800">{a.name}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(a.id, a.name)}
                    disabled={deletingId === a.id}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === a.id ? (
                      <span className="w-4 h-4 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
