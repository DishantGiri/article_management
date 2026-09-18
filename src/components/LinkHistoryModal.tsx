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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/60 px-2 py-0.5 rounded-full">
              Link log ID: #{linkLog.id}
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              History: {linkLog.affiliateName}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-medium">
              Product: {linkLog.product.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-2">
              <div className="w-8 h-8 border-4 border-indigo-100 dark:border-indigo-950 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-400">Fetching history logs...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">No edit history recorded yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">All subsequent updates made by linkers will be tracked here.</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l border-slate-200 dark:border-slate-800 space-y-8">
              {history.map((item, idx) => {
                const diffs = getDiffs(item);
                const isCreation = !item.oldStatus && !item.oldAffiliateLink && !item.oldBridgeLink;
                const isFlaggedIssue =
                  item.newStatus === "ISSUE" ||
                  Boolean(item.newRemarks && item.newRemarks.includes("[Flagged by"));

                return (
                  <div key={item.id} className="relative group">
                    {/* Circle timeline indicator */}
                    <div
                      className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 group-hover:scale-110 transition-transform flex items-center justify-center ${
                        isFlaggedIssue
                          ? "border-rose-500"
                          : isCreation
                          ? "border-emerald-500"
                          : "border-indigo-500"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          isFlaggedIssue
                            ? "bg-rose-500"
                            : isCreation
                            ? "bg-emerald-500"
                            : "bg-indigo-500"
                        }`}
                      />
                    </div>

                    <div className="bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-850/60 dark:hover:bg-slate-850 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm transition-all">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-800 dark:text-slate-100 font-bold">{item.updatedBy.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                              isFlaggedIssue
                                ? "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300"
                            }`}
                          >
                            {isFlaggedIssue
                              ? `Flagged By ${item.updatedBy?.role ? item.updatedBy.role.replace("_", " ") : "USER"}`
                              : item.updatedBy?.role ? item.updatedBy.role.replace("_", " ") : "USER"}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(item.updatedAt)}
                        </span>
                      </div>

                      {isFlaggedIssue ? (
                        <div className="p-3 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                              Link Issue Reported
                            </span>
                            <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/70 text-rose-800 dark:text-rose-300 text-[10px] font-extrabold">
                              Status: ISSUE
                            </span>
                          </div>
                          <div className="text-xs text-rose-900 dark:text-rose-100 font-medium leading-relaxed bg-white/80 dark:bg-slate-900 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/40">
                            {item.newRemarks?.replace(/^\[Flagged by [^\]]+\]:\s*/i, "") || "Link issue reported."}
                          </div>
                        </div>
                      ) : isCreation ? (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            🌱 Link Log Created
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px]">
                            {item.newAffiliateLink && (
                              <div><span className="font-bold text-slate-400">Affiliate:</span> <span className="text-slate-700 dark:text-slate-200 break-all">{item.newAffiliateLink}</span></div>
                            )}
                            {item.newBridgeLink && (
                              <div><span className="font-bold text-slate-400">Bridge:</span> <span className="text-slate-700 dark:text-slate-200 break-all">{item.newBridgeLink}</span></div>
                            )}
                            {item.newBuyLink && (
                              <div><span className="font-bold text-slate-400">Buy:</span> <span className="text-slate-700 dark:text-slate-200 break-all">{item.newBuyLink}</span></div>
                            )}
                            {item.newStatus && (
                              <div><span className="font-bold text-slate-400">Status:</span> <span className="text-slate-700 dark:text-slate-200">{item.newStatus}</span></div>
                            )}
                          </div>
                        </div>
                      ) : diffs.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">No fields were modified (metadata update)</p>
                      ) : (
                        <div className="space-y-3.5">
                          {diffs.map((diff, dIdx) => {
                            const DiffIcon = diff.icon;
                            return (
                              <div key={dIdx} className="space-y-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  <DiffIcon className="w-3 h-3 text-slate-400" />
                                  {diff.field}
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg">
                                  <div className="text-rose-600 dark:text-rose-200 font-medium bg-rose-50/40 dark:bg-rose-950/40 p-2 rounded border border-rose-100 dark:border-rose-900/60 break-all">
                                    <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 block uppercase mb-0.5">Old</span>
                                    {diff.oldVal}
                                  </div>
                                  <div className="text-emerald-700 dark:text-emerald-200 font-medium bg-emerald-50/40 dark:bg-emerald-950/40 p-2 rounded border border-emerald-100 dark:border-emerald-900/60 break-all">
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase mb-0.5">New</span>
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
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white dark:border dark:border-slate-700 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Close Log
          </button>
        </div>
      </div>
    </div>
  );
}
