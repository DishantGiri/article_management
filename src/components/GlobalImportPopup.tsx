"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  RefreshCw,
  Square,
  X,
} from "lucide-react";
import { useImport } from "@/context/ImportContext";

function formatElapsed(startedAt: number | null, finishedAt: number | null, now: number): string {
  if (!startedAt) return "0s";
  const end = finishedAt ?? now;
  const secs = Math.max(0, Math.floor((end - startedAt) / 1000));
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return mins > 0 ? `${mins}m ${rem}s` : `${rem}s`;
}

export default function GlobalImportPopup() {
  const router = useRouter();
  const {
    mergedJob,
    stopMergedImport,
    dismissMergedJob,
    productJob,
    dismissProductJob,
    isProductModalOpen,
    setIsProductModalOpen,
    popupVisible,
    popupMinimized,
    setPopupMinimized,
    popupExpandedModal,
    setPopupExpandedModal,
  } = useImport();

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
  }, []);

  const isRunning = mergedJob.status === "running" || productJob.status === "running";

  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isRunning]);

  if (!mounted || !popupVisible) return null;

  // Prefer the active running job, else whichever job holds non-idle state
  const activeKind: "merged" | "product" | null =
    mergedJob.status === "running"
      ? "merged"
      : productJob.status === "running"
      ? "product"
      : mergedJob.status !== "idle"
      ? "merged"
      : productJob.status !== "idle"
      ? "product"
      : null;

  if (!activeKind) return null;

  // When the centered ImportProductModal is already open on screen for the product job,
  // avoid rendering a duplicate floating card on top of it; the moment the modal closes
  // or the user navigates to another tab/page, this popup stays visible!
  if (activeKind === "product" && isProductModalOpen && !popupExpandedModal) {
    return null;
  }

  const isMerged = activeKind === "merged";
  const status = isMerged ? mergedJob.status : productJob.status;
  const fileName = (isMerged ? mergedJob.fileName : productJob.fileName) || "Spreadsheet Import";
  const startedAt = isMerged ? mergedJob.startedAt : productJob.startedAt;
  const finishedAt = isMerged ? mergedJob.finishedAt : productJob.finishedAt;
  const elapsed = formatElapsed(startedAt, finishedAt, now);

  const handleCloseCompleted = () => {
    if (isMerged) {
      dismissMergedJob();
    } else {
      dismissProductJob();
    }
  };

  const handleOpenSourceTab = () => {
    setPopupExpandedModal(false);
    if (isMerged) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("settings:switch-tab", { detail: "import-sheet" }));
      }
      router.push("/settings?tab=import-sheet");
    } else {
      router.push("/products");
      setIsProductModalOpen(true);
    }
  };

  // Compact minimized corner pill (never blocks tabs)
  if (popupMinimized && !popupExpandedModal) {
    return createPortal(
      <div className="fixed bottom-5 right-5 z-[115]">
        <button
          type="button"
          onClick={() => setPopupMinimized(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white border border-indigo-500/40 shadow-2xl hover:bg-slate-800 transition cursor-pointer"
        >
          {status === "running" ? (
            <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
          ) : status === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-bold whitespace-nowrap">
            {status === "running"
              ? isMerged && mergedJob.progress
                ? `Importing ${mergedJob.progress.percent}%`
                : `Importing ${productJob.totalRows} rows...`
              : status === "error"
              ? "Import Issue"
              : "Import Complete"}
          </span>
          <span className="text-[11px] font-mono text-slate-300">{elapsed}</span>
          <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>,
      document.body
    );
  }

  // Shared card/modal body content
  const renderMergedContent = () => {
    const progress = mergedJob.progress;
    const stats = mergedJob.result?.stats || mergedJob.liveStats;

    return (
      <div className="space-y-3">
        {mergedJob.status === "running" && progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Batch {progress.currentChunk} of {progress.totalChunks}
              </span>
              <span className="font-black font-mono text-indigo-600 dark:text-indigo-400">
                {progress.percent}% ({progress.processedRows}/{progress.totalRows})
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              You can freely switch Settings tabs or pages — import continues running in this popup.
            </p>
          </div>
        )}

        {mergedJob.result && (
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
            {mergedJob.result.message}
          </p>
        )}

        {mergedJob.errorMessage && !mergedJob.result && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {mergedJob.errorMessage}
          </p>
        )}

        {stats && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">New</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {stats.createdProducts}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Updated</span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                {stats.updatedProducts}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Links/GEOs</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                {stats.configuredLinks} / {stats.configuredGeos}
              </span>
            </div>
          </div>
        )}

        {popupExpandedModal && stats?.errors && stats.errors.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs max-h-48 overflow-y-auto space-y-1">
            <div className="font-bold text-amber-800 dark:text-amber-200">
              Warnings ({stats.errors.length})
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-700 dark:text-amber-300">
              {stats.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderProductContent = () => {
    const res = productJob.result;
    return (
      <div className="space-y-3">
        {productJob.status === "running" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Importing {productJob.totalRows} products...
              </span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {elapsed}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 rounded-full animate-pulse" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              You can switch tabs or navigate freely — import stays active in the background.
            </p>
          </div>
        )}

        {productJob.errorMessage && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {productJob.errorMessage}
          </p>
        )}

        {res && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Imported <strong>{res.importedCount}</strong> new products
              {res.skippedCount ? ` (${res.skippedCount} existing skipped)` : ""}.
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Imported</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {res.importedCount}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Skipped</span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                  {res.skippedCount || 0}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Links/GEOs</span>
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                  {res.importedLinksCount || 0} / {res.importedGeosCount || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const cardHeader = (
    <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/80 dark:bg-slate-900">
      <div className="flex items-center gap-2.5 min-w-0">
        {status === "running" ? (
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4 animate-spin" />
          </div>
        ) : status === "error" ? (
          <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
              {status === "running"
                ? isMerged
                  ? "Merged Sheet Importing"
                  : "Products Importing"
                : status === "stopped"
                ? "Import Stopped"
                : status === "error"
                ? "Import Attention Needed"
                : "Import Finished"}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
              {elapsed}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3 shrink-0" />
            <span className="truncate">{fileName}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setPopupExpandedModal(!popupExpandedModal)}
          title={popupExpandedModal ? "Dock to corner popup" : "Expand popup"}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          {popupExpandedModal ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>
        {!popupExpandedModal && (
          <button
            type="button"
            onClick={() => setPopupMinimized(true)}
            title="Minimize to pill"
            className="px-1.5 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            –
          </button>
        )}
        {status !== "running" && (
          <button
            type="button"
            onClick={handleCloseCompleted}
            title="Dismiss popup"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  const cardFooter = (
    <div className="px-4 py-2.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={handleOpenSourceTab}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
      >
        <ExternalLink className="w-3 h-3" />
        <span>{isMerged ? "Open Import Tab" : "Open Products Import"}</span>
      </button>

      <div className="flex items-center gap-2">
        {isMerged && status === "running" && (
          <button
            type="button"
            onClick={stopMergedImport}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[11px] font-bold transition cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop</span>
          </button>
        )}
        {status !== "running" && (
          <button
            type="button"
            onClick={handleCloseCompleted}
            className="px-3 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold hover:opacity-90 transition cursor-pointer"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );

  // Expanded centered modal mode (user clicked Maximize — clicking backdrop docks back to corner rather than cancelling!)
  if (popupExpandedModal) {
    return createPortal(
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs"
        onClick={() => setPopupExpandedModal(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {cardHeader}
          <div className="p-5">{isMerged ? renderMergedContent() : renderProductContent()}</div>
          {cardFooter}
        </div>
      </div>,
      document.body
    );
  }

  // Non-blocking persistent corner popup so user can freely switch tabs & pages without interrupting import
  return createPortal(
    <div className="fixed bottom-5 right-5 z-[115] w-[calc(100vw-2rem)] sm:w-[400px] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
      {cardHeader}
      <div className="p-4">{isMerged ? renderMergedContent() : renderProductContent()}</div>
      {cardFooter}
    </div>,
    document.body
  );
}
