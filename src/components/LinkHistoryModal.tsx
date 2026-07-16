"use client";

import { useEffect, useState } from "react";
import { X, Clock, User, Link, ShoppingBag, Info, ShieldAlert } from "lucide-react";

interface LinkHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkLog: {
    id: number;
    affiliateName: string;
    product: { name: string };
  } | null;
}

interface HistoryItem {
  id: number;
  updatedAt: string;
  updatedBy: { name: string; role: string };
  oldBridgeLink?: string | null;
  newBridgeLink?: string | null;
  oldBuyLink?: string | null;
  newBuyLink?: string | null;
  oldAffiliateLink?: string | null;
  newAffiliateLink?: string | null;
  oldStatus?: string | null;
  newStatus?: string | null;
  oldRemarks?: string | null;
  newRemarks?: string | null;
}

export default function LinkHistoryModal({ isOpen, onClose, linkLog }: LinkHistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !linkLog) return;

    setLoading(true);
    fetch(`/api/links/${linkLog.id}/history`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load history");
        return res.json();
      })
      .then((data) => {
        setHistory(data);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, linkLog]);

  if (!isOpen || !linkLog) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDiffs = (item: HistoryItem) => {
    const diffs: { field: string; oldVal: string; newVal: string; icon: any }[] = [];

    if (item.oldAffiliateLink !== item.newAffiliateLink) {
      diffs.push({
        field: "Affiliate Link",
        oldVal: item.oldAffiliateLink || "Not set",
        newVal: item.newAffiliateLink || "Not set",
        icon: Link,
      });
    }
    if (item.oldBridgeLink !== item.newBridgeLink) {
      diffs.push({
        field: "Bridge Page Link",
        oldVal: item.oldBridgeLink || "Not set",
        newVal: item.newBridgeLink || "Not set",
        icon: Link,
      });
    }
    if (item.oldBuyLink !== item.newBuyLink) {
      diffs.push({
        field: "Buy Link",
        oldVal: item.oldBuyLink || "Not set",
        newVal: item.newBuyLink || "Not set",
        icon: ShoppingBag,
      });
    }
    if (item.oldStatus !== item.newStatus) {
      diffs.push({
        field: "Status",
        oldVal: item.oldStatus || "None",
        newVal: item.newStatus || "None",
        icon: Info,
      });
    }
    if (item.oldRemarks !== item.newRemarks) {
      diffs.push({
        field: "Remarks",
        oldVal: item.oldRemarks || "None",
        newVal: item.newRemarks || "None",
        icon: ShieldAlert,
      });
    }

    return diffs;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              Link log ID: #{linkLog.id}
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              History: {linkLog.affiliateName}
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Product: {linkLog.product.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-2">
              <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-400">Fetching history logs...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <Clock className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-500">No edit history recorded yet</p>
              <p className="text-xs text-slate-400">All subsequent updates made by linkers will be tracked here.</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l border-slate-200 space-y-8">
              {history.map((item, idx) => {
                const diffs = getDiffs(item);
                const isCreation = !item.oldStatus && !item.oldAffiliateLink && !item.oldBridgeLink;

                return (
                  <div key={item.id} className="relative group">
                    {/* Circle timeline indicator */}
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 group-hover:scale-110 transition-transform flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    </div>

                    <div className="bg-slate-50/50 hover:bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm transition-all">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-800 font-bold">{item.updatedBy.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            {item.updatedBy.role.replace("_", " ")}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(item.updatedAt)}
                        </span>
                      </div>

                      {isCreation ? (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                            🌱 Link Log Created
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 bg-white p-3 rounded-lg border border-slate-100 text-[11px]">
                            {item.newAffiliateLink && (
                              <div><span className="font-bold text-slate-400">Affiliate:</span> <span className="text-slate-700 break-all">{item.newAffiliateLink}</span></div>
                            )}
                            {item.newBridgeLink && (
                              <div><span className="font-bold text-slate-400">Bridge:</span> <span className="text-slate-700 break-all">{item.newBridgeLink}</span></div>
                            )}
                            {item.newBuyLink && (
                              <div><span className="font-bold text-slate-400">Buy:</span> <span className="text-slate-700 break-all">{item.newBuyLink}</span></div>
                            )}
                            {item.newStatus && (
                              <div><span className="font-bold text-slate-400">Status:</span> <span className="text-slate-700">{item.newStatus}</span></div>
                            )}
                          </div>
                        </div>
                      ) : diffs.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No fields were modified (metadata update)</p>
                      ) : (
                        <div className="space-y-3.5">
                          {diffs.map((diff, dIdx) => {
                            const DiffIcon = diff.icon;
                            return (
                              <div key={dIdx} className="space-y-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  <DiffIcon className="w-3 h-3 text-slate-400" />
                                  {diff.field}
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white border border-slate-100 p-2.5 rounded-lg">
                                  <div className="text-rose-600 font-medium bg-rose-50/30 p-1.5 rounded border border-rose-100/50 break-all">
                                    <span className="text-[10px] font-bold text-rose-500 block uppercase mb-0.5">Old</span>
                                    {diff.oldVal}
                                  </div>
                                  <div className="text-emerald-700 font-medium bg-emerald-50/20 p-1.5 rounded border border-emerald-100/40 break-all">
                                    <span className="text-[10px] font-bold text-emerald-600 block uppercase mb-0.5">New</span>
                                    {diff.newVal}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition"
          >
            Close Logs
          </button>
        </div>
      </div>
    </div>
  );
}
