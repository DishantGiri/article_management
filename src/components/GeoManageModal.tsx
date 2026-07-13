"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, Globe } from "lucide-react";
import { toast } from "react-hot-toast";

interface GeoEntry {
  id: number;
  code: string;
  createdAt: string;
}

interface GeoManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GeoManageModal({ isOpen, onClose }: GeoManageModalProps) {
  const [geos, setGeos] = useState<GeoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fetchGeos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/geos");
      const data = await res.json();
      setGeos(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load GEOs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setNewCode("");
      setError("");
      fetchGeos();
    }
  }, [isOpen]);

  const handleAdd = async () => {
    const trimmed = newCode.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter a GEO code.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/geos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 200) {
        setError(data.error || "Failed to add GEO.");
        return;
      }
      toast.success(`"${trimmed}" added!`);
      setNewCode("");
      await fetchGeos();
    } catch {
      setError("Something went wrong.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`Delete GEO "${code}"? It will no longer appear in the selector, but existing link logs keep their value.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/geos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Failed to delete GEO.");
        return;
      }
      toast.success(`"${code}" removed.`);
      setGeos((prev) => prev.filter((g) => g.id !== id));
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
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Globe className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Manage GEOs</h2>
              <p className="text-xs text-slate-400 font-medium">{geos.length} custom GEOs</p>
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
            Add Custom GEO Code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && !adding && handleAdd()}
              placeholder="e.g. IN, SG, NZ, LATAM..."
              maxLength={20}
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition font-mono uppercase"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newCode.trim()}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-rose-500 font-medium">{error}</p>
          )}
          <p className="mt-2 text-[10px] text-slate-400 font-medium">
            Only GEOs added here will appear in the link selector.
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-400">Loading...</p>
            </div>
          ) : geos.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">No custom GEOs yet</p>
              <p className="text-xs text-slate-400 mt-1">Add country codes above to extend the selector.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {geos.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-sm font-bold text-slate-800 font-mono tracking-wide">{g.code}</span>
                    <span className="text-[10px] text-slate-400 font-medium">custom</span>
                  </div>
                  <button
                    onClick={() => handleDelete(g.id, g.code)}
                    disabled={deletingId === g.id}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === g.id ? (
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
