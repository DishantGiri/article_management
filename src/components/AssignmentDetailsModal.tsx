"use client";

import { useState } from "react";
import Link from "next/link";
import {
  X,
  ExternalLink,
  Globe,
  ShoppingCart,
  Link2,
  Copy,
  Check,
  Building2,
  Tag,
  LayoutGrid,
  TrendingUp,
  AlertTriangle,
  PlayCircle,
  FileText,
  User,
  Clock,
  Sparkles,
  Share2,
  Calendar,
} from "lucide-react";
import { toast } from "react-hot-toast";
import FormattedRemarks, { formatRemarkDate } from "@/components/FormattedRemarks";
import { getCountryFlag, COUNTRY_NAMES } from "@/lib/geo-constants";

export interface AssignmentProduct {
  id: number;
  name: string;
  slug?: string | null;
  siteId: number;
  categoryId: number;
  productCategory?: string | null;
  trendLink?: string;
  trendLevel?: string;
  affiliateName?: string | null;
  previewLink?: string;
  remarks?: string;
  addedAt: string;
  site: { id?: number; name: string; url?: string };
  category: { id?: number; name: string };
  addedBy: { id?: number; name: string };
  article?: {
    id: number;
    status: string;
    priority?: string;
    writer?: { id?: number; name: string };
  };
  linkLogs?: Array<{
    id: number;
    affiliateName: string;
    affiliateLink: string;
    bridgePageLink?: string | null;
    buyLink?: string | null;
    status: string;
    linkerRemarks?: string | null;
    addedAt?: string;
    updatedAt?: string;
    geos?: Array<{ geo: string }>;
  }>;
}

interface AssignmentDetailsModalProps {
  product: AssignmentProduct;
  currentUserRole?: string;
  currentUserId?: string | number;
  onClose: () => void;
  onReportIssue?: (product: AssignmentProduct) => void;
}

const LINK_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ACCEPTED: {
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800/60",
  },
  REQUESTED: {
    bg: "bg-sky-50 dark:bg-sky-950/60",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-800/60",
  },
  ISSUE: {
    bg: "bg-rose-50 dark:bg-rose-950/60",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800/60",
  },
  NEED_TO_CHECK: {
    bg: "bg-amber-50 dark:bg-amber-950/60",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/60",
  },
  PRESELL_PAGE: {
    bg: "bg-purple-50 dark:bg-purple-950/60",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800/60",
  },
  REDIRECTED: {
    bg: "bg-indigo-50 dark:bg-indigo-950/60",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800/60",
  },
  CANCELED: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-700",
  },
};

const ARTICLE_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  IN_PROGRESS: { bg: "bg-blue-100 dark:bg-blue-950/60", text: "text-blue-800 dark:text-blue-300" },
  COMPLETED: { bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  APPROVED: { bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
  REDO: { bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
};

export default function AssignmentDetailsModal({
  product,
  currentUserRole,
  currentUserId,
  onClose,
  onReportIssue,
}: AssignmentDetailsModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeLogIndex, setActiveLogIndex] = useState<number>(0);
  const [startingWriting, setStartingWriting] = useState<boolean>(false);

  const linkLogs = product.linkLogs || [];
  const hasLinkLogs = linkLogs.length > 0;
  const currentLog = linkLogs[activeLogIndex] || linkLogs[0];

  const handleCopy = (text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${label}!`);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleCopyAllLinks = (log: (typeof linkLogs)[0]) => {
    const lines = [
      `Product: ${product.name}`,
      `Site: ${product.site?.name || ""}`,
      log.bridgePageLink ? `Bridge Page: ${log.bridgePageLink}` : null,
      log.buyLink ? `Buy Link: ${log.buyLink}` : null,
      log.affiliateLink ? `Affiliate Link: ${log.affiliateLink}` : null,
      log.geos && log.geos.length > 0
        ? `Target Geos: ${log.geos.map((g) => g.geo).join(", ")}`
        : null,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedKey("all-links");
    toast.success("Copied all routing links to clipboard!");
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleStartWriting = async () => {
    if (!product.article) return;
    setStartingWriting(true);
    try {
      const uId = currentUserId || 1;
      const res = await fetch(`/api/articles/${product.article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS", writerId: uId, callerId: uId }),
      });
      if (res.ok) {
        toast.success("Started writing! Redirecting to tracker...");
        setTimeout(() => {
          window.location.href = "/#writer-tracker";
        }, 500);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to start writing");
        setStartingWriting(false);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start writing");
      setStartingWriting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#6D8196]/10 dark:bg-[#6D8196]/20 border border-[#6D8196]/20 flex items-center justify-center text-[#6D8196] dark:text-sky-400 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Assignment Details
                </h2>
                <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                  #{product.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Product specifications, affiliate routing, and target country links
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
            title="Close (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200">
          {/* Product Title & Metadata Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 group">
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {product.name}
                  </h3>
                  <button
                    onClick={() => handleCopy(product.name, "product-name", "Product Name")}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#6D8196] hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Copy Product Name"
                  >
                    {copiedKey === "product-name" ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Metadata Pills */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700/60 shadow-2xs">
                    <Building2 className="w-3.5 h-3.5 text-[#6D8196]" />
                    <span>{product.site.name}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700/60 shadow-2xs">
                    <LayoutGrid className="w-3.5 h-3.5 text-[#6D8196]" />
                    <span>Type: {product.category?.name || "—"}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700/60 shadow-2xs">
                    <Tag className="w-3.5 h-3.5 text-[#6D8196]" />
                    <span>Category: {product.productCategory || "—"}</span>
                  </span>

                  {product.trendLevel && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800/60 shadow-2xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{product.trendLevel} Trend</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Trend & Preview External Links */}
              {(product.trendLink || product.previewLink) && (
                <div className="flex flex-wrap items-center gap-2">
                  {product.trendLink && (
                    <a
                      href={product.trendLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-2xs transition"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-[#6D8196]" />
                      <span>Trend Link</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}

                  {product.previewLink && (
                    <a
                      href={product.previewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold border border-indigo-200/80 dark:border-indigo-800/50 shadow-2xs transition"
                    >
                      <Globe className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Preview Link</span>
                      <ExternalLink className="w-3 h-3 text-indigo-400" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Product Remarks */}
            {product.remarks && (
              <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="font-bold uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-400">
                      Product Instructions / Remarks
                    </span>
                  </div>
                  {product.addedAt && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/60 shadow-2xs">
                      <Calendar className="w-3 h-3 text-amber-500 shrink-0" />
                      {formatRemarkDate(product.addedAt)}
                    </span>
                  )}
                </div>
                <FormattedRemarks remarks={product.remarks} date={product.addedAt} textClass="text-xs font-medium" />
              </div>
            )}

            {/* Article Assignment Info (if exists) */}
            {product.article && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {product.article.writer?.name || "Unassigned Writer"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          ARTICLE_STATUS_STYLES[product.article.status]?.bg || "bg-slate-100"
                        } ${ARTICLE_STATUS_STYLES[product.article.status]?.text || "text-slate-700"}`}
                      >
                        {product.article.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Article ID #{product.article.id} • Assigned for content creation
                    </span>
                  </div>
                </div>

                {currentUserRole !== "WRITER" && currentUserRole !== "LINKER" && (
                  <Link
                    href={`/articles/${product.article.id}`}
                    className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-600 shadow-2xs transition flex items-center gap-1.5"
                  >
                    <span>View Article</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Links & Geos Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Links & Geos
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#6D8196]/10 dark:bg-[#6D8196]/30 text-[#3D4F61] dark:text-sky-300 border border-[#6D8196]/20">
                  {linkLogs.length} {linkLogs.length === 1 ? "Link Configuration" : "Configurations"}
                </span>
              </div>

              {/* Quick Actions (Copy All Links, Report Issue) */}
              {hasLinkLogs && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyAllLinks(currentLog)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                    title="Copy all links formatted for this network"
                  >
                    {copiedKey === "all-links" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied All!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy All Links</span>
                      </>
                    )}
                  </button>

                  {onReportIssue && (
                    <button
                      onClick={() => onReportIssue(product)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold border border-rose-200/80 dark:border-rose-800/60 transition cursor-pointer shadow-2xs"
                      title="Report dead, broken, or misconfigured link"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Report Issue</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Multiple Link Logs Tabs Selector */}
            {linkLogs.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {linkLogs.map((log, idx) => {
                  const statusStyle = LINK_STATUS_STYLES[log.status] || LINK_STATUS_STYLES.REQUESTED;
                  const isActive = activeLogIndex === idx;
                  return (
                    <button
                      key={log.id}
                      onClick={() => setActiveLogIndex(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap border ${
                        isActive
                          ? "bg-[#6D8196] text-white border-[#6D8196] shadow-xs"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{log.affiliateName || `Network #${log.id}`}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
                          isActive ? "bg-white/20 text-white" : `${statusStyle.bg} ${statusStyle.text}`
                        }`}
                      >
                        {log.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Main Link Log Display (Full-Width Adaptive Card) */}
            {!hasLinkLogs ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <Link2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  No affiliate links or bridge pages configured for this product yet.
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Linkers will configure routing URLs and target country geos shortly.
                </p>
              </div>
            ) : (
              <div className="p-5 bg-slate-50/70 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-2xs">
                {/* Network & Status Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                      {currentLog.affiliateName || "Standard Affiliate"}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        LINK_STATUS_STYLES[currentLog.status]?.bg || "bg-blue-50"
                      } ${LINK_STATUS_STYLES[currentLog.status]?.text || "text-blue-700"} ${
                        LINK_STATUS_STYLES[currentLog.status]?.border || "border-blue-200"
                      }`}
                    >
                      {currentLog.status}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    Log #{currentLog.id}
                  </span>
                </div>

                {/* URLs Section (Bridge Page, Buy Link, Affiliate Link) */}
                <div className="space-y-2.5">
                  {/* Bridge Page Link (Highest priority for writers!) */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-[#6D8196]/60 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                          Bridge Page URL
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          (Used in Article Buttons)
                        </span>
                      </div>

                      {currentLog.bridgePageLink && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              handleCopy(
                                currentLog.bridgePageLink!,
                                `bridge-${currentLog.id}`,
                                "Bridge Page URL"
                              )
                            }
                            className="p-1 px-2 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                            title="Copy Bridge Page URL"
                          >
                            {copiedKey === `bridge-${currentLog.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          <a
                            href={currentLog.bridgePageLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 px-1.5 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700"
                            title="Open Bridge Page in New Tab"
                          >
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        </div>
                      )}
                    </div>

                    {currentLog.bridgePageLink ? (
                      <a
                        href={currentLog.bridgePageLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline break-all block"
                      >
                        {currentLog.bridgePageLink}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Not configured (Bridge page required before Acceptance)
                      </span>
                    )}
                  </div>

                  {/* Buy Link */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-[#6D8196]/60 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          Direct Buy Link
                        </span>
                      </div>

                      {currentLog.buyLink && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              handleCopy(currentLog.buyLink!, `buy-${currentLog.id}`, "Buy Link")
                            }
                            className="p-1 px-2 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                            title="Copy Buy Link"
                          >
                            {copiedKey === `buy-${currentLog.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          <a
                            href={currentLog.buyLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 px-1.5 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700"
                            title="Open Buy Link in New Tab"
                          >
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        </div>
                      )}
                    </div>

                    {currentLog.buyLink ? (
                      <a
                        href={currentLog.buyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 hover:underline break-all block"
                      >
                        {currentLog.buyLink}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No direct buy link</span>
                    )}
                  </div>

                  {/* Affiliate Link */}
                  {currentLog.affiliateLink && (
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-[#6D8196]/60 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-[#6D8196] shrink-0" />
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Affiliate Destination Link
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              handleCopy(
                                currentLog.affiliateLink,
                                `aff-${currentLog.id}`,
                                "Affiliate Link"
                              )
                            }
                            className="p-1 px-2 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                            title="Copy Affiliate Link"
                          >
                            {copiedKey === `aff-${currentLog.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          <a
                            href={currentLog.affiliateLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 px-1.5 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition border border-slate-200 dark:border-slate-700"
                            title="Open Destination Link in New Tab"
                          >
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        </div>
                      </div>

                      <a
                        href={currentLog.affiliateLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300 hover:underline break-all block"
                      >
                        {currentLog.affiliateLink}
                      </a>
                    </div>
                  )}
                </div>

                {/* Remarks */}
                {currentLog.linkerRemarks && (
                  <div className="pt-1">
                    <FormattedRemarks remarks={currentLog.linkerRemarks} date={currentLog.addedAt} textClass="text-xs" />
                  </div>
                )}

                {/* Target Geos Section */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Target Geos ({currentLog.geos?.length || 0})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Eligible audience country traffic
                    </span>
                  </div>

                  {currentLog.geos && currentLog.geos.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {currentLog.geos.map((g) => {
                        const flag = getCountryFlag(g.geo);
                        const countryName =
                          COUNTRY_NAMES[g.geo.toUpperCase()] ||
                          COUNTRY_NAMES[g.geo] ||
                          g.geo;
                        return (
                          <div
                            key={g.geo}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:border-[#6D8196] transition-colors"
                            title={`${g.geo} — ${countryName}`}
                          >
                            <span className="text-sm leading-none">{flag}</span>
                            <span className="uppercase">{g.geo}</span>
                            <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                              ({countryName})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      No specific countries assigned (Global / Default)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0 rounded-b-3xl">
          <div className="flex items-center gap-2">
            {onReportIssue && hasLinkLogs && (
              <button
                onClick={() => onReportIssue(product)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>Report Issue</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs"
            >
              Close
            </button>

            {/* Writer Action: Start Writing */}
            {(currentUserRole === "WRITER" || currentUserRole === "TEAM_LEAD") &&
              product.article?.status === "PENDING" && (
                <button
                  onClick={handleStartWriting}
                  disabled={startingWriting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>{startingWriting ? "Starting..." : "Start Writing"}</span>
                </button>
              )}

            {/* Non-Writer Action: View Article */}
            {currentUserRole !== "WRITER" && currentUserRole !== "LINKER" && product.article && (
              <Link
                href={`/articles/${product.article.id}`}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View Article Tracking</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
