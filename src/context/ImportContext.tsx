"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

export interface MergedImportProgress {
  currentChunk: number;
  totalChunks: number;
  processedRows: number;
  totalRows: number;
  percent: number;
}

export interface MergedImportStats {
  totalRows: number;
  processed: number;
  createdProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  createdSites: number;
  assignedWriters: number;
  configuredLinks: number;
  configuredGeos: number;
  uniqueSites: string[];
  errors: string[];
}

export interface MergedImportResult {
  success: boolean;
  message: string;
  stats: MergedImportStats;
}

export interface MergedSheetDraft {
  fileName: string | null;
  sheetNames: string[];
  activeSheetTab: string;
  importScope: "ALL" | "ACTIVE";
  allParsedRows: any[];
  updateExisting: boolean;
  skipAlreadyImported: boolean;
  existingKeys: string[];
  rowFilter: "ALL" | "REMAINING" | "IMPORTED";
  searchQuery: string;
}

export interface ProductImportResult {
  success: boolean;
  importedCount: number;
  importedLinksCount?: number;
  importedGeosCount?: number;
  skippedCount?: number;
  skipped?: string[];
  errors: string[];
}

export interface ProductImportDraft {
  fileName: string | null;
  parsedData: any[];
}

export interface MergedImportJobState {
  status: "idle" | "running" | "completed" | "stopped" | "error";
  fileName: string | null;
  progress: MergedImportProgress | null;
  liveStats: MergedImportStats | null;
  result: MergedImportResult | null;
  errorMessage: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface ProductImportJobState {
  status: "idle" | "running" | "completed" | "error";
  fileName: string | null;
  totalRows: number;
  result: ProductImportResult | null;
  errorMessage: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

interface ImportContextValue {
  // Merged sheet draft + job
  mergedDraft: MergedSheetDraft;
  setMergedDraft: React.Dispatch<React.SetStateAction<MergedSheetDraft>>;
  resetMergedDraft: () => void;
  mergedJob: MergedImportJobState;
  startMergedImport: (params: {
    fileName: string;
    rowsToImport: any[];
    updateExisting: boolean;
    skipAlreadyImported?: boolean;
  }) => Promise<void>;
  stopMergedImport: () => void;
  dismissMergedJob: () => void;

  // Product import draft + job
  productDraft: ProductImportDraft;
  setProductDraft: React.Dispatch<React.SetStateAction<ProductImportDraft>>;
  resetProductDraft: () => void;
  productJob: ProductImportJobState;
  startProductImport: (params: {
    fileName: string;
    products: any[];
    userId: string;
  }) => Promise<ProductImportResult | null>;
  dismissProductJob: () => void;
  isProductModalOpen: boolean;
  setIsProductModalOpen: (open: boolean) => void;

  // Global floating popup UI state
  popupVisible: boolean;
  setPopupVisible: (visible: boolean) => void;
  popupMinimized: boolean;
  setPopupMinimized: (minimized: boolean) => void;
  popupExpandedModal: boolean;
  setPopupExpandedModal: (expanded: boolean) => void;
}

const INITIAL_MERGED_DRAFT: MergedSheetDraft = {
  fileName: null,
  sheetNames: [],
  activeSheetTab: "ALL",
  importScope: "ALL",
  allParsedRows: [],
  updateExisting: true,
  skipAlreadyImported: true,
  existingKeys: [],
  rowFilter: "ALL",
  searchQuery: "",
};

const INITIAL_MERGED_JOB: MergedImportJobState = {
  status: "idle",
  fileName: null,
  progress: null,
  liveStats: null,
  result: null,
  errorMessage: null,
  startedAt: null,
  finishedAt: null,
};

const INITIAL_PRODUCT_DRAFT: ProductImportDraft = {
  fileName: null,
  parsedData: [],
};

const INITIAL_PRODUCT_JOB: ProductImportJobState = {
  status: "idle",
  fileName: null,
  totalRows: 0,
  result: null,
  errorMessage: null,
  startedAt: null,
  finishedAt: null,
};

const ImportContext = createContext<ImportContextValue | null>(null);

const MERGED_CHUNK_SIZE = 30;

async function parseJsonResponseSafe(res: Response, fallbackLabel: string): Promise<any> {
  const rawText = await res.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    if (!res.ok) {
      throw new Error(`${fallbackLabel} (HTTP ${res.status}): Empty response from server`);
    }
    return {};
  }
  if (trimmed.startsWith("<")) {
    const titleMatch = trimmed.match(/<title[^>]*>([^<]+)<\/title>/i);
    const detail = titleMatch ? titleMatch[1].trim() : "HTML error page returned";
    throw new Error(
      `${fallbackLabel} (HTTP ${res.status}): ${detail}. If this was a gateway timeout, retrying smaller batches...`
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`${fallbackLabel} (HTTP ${res.status}): Invalid server response`);
  }
}

export function ImportProvider({ children }: { children: React.ReactNode }) {
  const [mergedDraft, setMergedDraft] = useState<MergedSheetDraft>(INITIAL_MERGED_DRAFT);
  const [mergedJob, setMergedJob] = useState<MergedImportJobState>(INITIAL_MERGED_JOB);
  const cancelMergedRef = useRef(false);
  const mergedRunningRef = useRef(false);

  const [productDraft, setProductDraft] = useState<ProductImportDraft>(INITIAL_PRODUCT_DRAFT);
  const [productJob, setProductJob] = useState<ProductImportJobState>(INITIAL_PRODUCT_JOB);
  const productRunningRef = useRef(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupMinimized, setPopupMinimized] = useState(false);
  const [popupExpandedModal, setPopupExpandedModal] = useState(false);

  const isAnyRunning = mergedJob.status === "running" || productJob.status === "running";

  // Warn only when closing/reloading the browser window itself; switching app/settings/browser tabs never cancels!
  useEffect(() => {
    if (!isAnyRunning || typeof window === "undefined") return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "An import is currently in progress.";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isAnyRunning]);

  const resetMergedDraft = useCallback(() => {
    setMergedDraft(INITIAL_MERGED_DRAFT);
    setMergedJob((prev) => (prev.status === "running" ? prev : INITIAL_MERGED_JOB));
  }, []);

  const stopMergedImport = useCallback(() => {
    cancelMergedRef.current = true;
  }, []);

  const dismissMergedJob = useCallback(() => {
    setMergedJob((prev) => (prev.status === "running" ? prev : INITIAL_MERGED_JOB));
    if (productJob.status === "idle") {
      setPopupVisible(false);
      setPopupExpandedModal(false);
    }
  }, [productJob.status]);

  const startMergedImport = useCallback(
    async ({
      fileName,
      rowsToImport,
      updateExisting,
      skipAlreadyImported = false,
    }: {
      fileName: string;
      rowsToImport: any[];
      updateExisting: boolean;
      skipAlreadyImported?: boolean;
    }) => {
      if (mergedRunningRef.current) {
        toast("A merged sheet import is already running in the background.");
        setPopupVisible(true);
        setPopupMinimized(false);
        return;
      }

      if (!rowsToImport || rowsToImport.length === 0) {
        toast.error("No valid rows found in the selected scope.");
        return;
      }

      mergedRunningRef.current = true;
      cancelMergedRef.current = false;

      // When Skip Already Imported is enabled, query DB once up front so already-imported rows
      // are skipped without re-sending them, while new multi-row products in the remaining set still merge across chunks.
      let effectiveRows = rowsToImport;
      let skippedCount = 0;

      if (skipAlreadyImported) {
        try {
          const checkItems = rowsToImport.map((r) => ({
            siteName: String(r["Site Name"] || "").trim(),
            productName: String(r["Product Name"] || "").trim(),
          }));
          const existingSet = new Set<string>();
          const CHECK_BATCH = 500;
          for (let c = 0; c < checkItems.length; c += CHECK_BATCH) {
            const checkRes = await fetch("/api/admin/import-merged-sheet", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "check-existing",
                items: checkItems.slice(c, c + CHECK_BATCH),
              }),
            });
            const checkData = await parseJsonResponseSafe(checkRes, "Pre-check failed");
            if (checkRes.ok && Array.isArray(checkData.existingKeys)) {
              for (const k of checkData.existingKeys) {
                existingSet.add(k);
              }
            }
          }

          if (existingSet.size > 0) {
            const remaining: any[] = [];
            for (const r of rowsToImport) {
              const key = `${String(r["Site Name"] || "").trim().toLowerCase()}::${String(r["Product Name"] || "").trim().toLowerCase()}`;
              if (existingSet.has(key)) {
                skippedCount++;
              } else {
                remaining.push(r);
              }
            }
            effectiveRows = remaining;
          }
        } catch (preErr) {
          console.warn("Pre-check existing failed, continuing with server-side handling:", preErr);
        }
      }

      if (skipAlreadyImported && effectiveRows.length === 0) {
        const allSkippedStats: MergedImportStats = {
          totalRows: rowsToImport.length,
          processed: 0,
          createdProducts: 0,
          updatedProducts: 0,
          skippedProducts: skippedCount,
          createdSites: 0,
          assignedWriters: 0,
          configuredLinks: 0,
          configuredGeos: 0,
          uniqueSites: [],
          errors: [],
        };
        const msg = `All ${skippedCount} selected row(s) are already imported. 0 remaining rows to import.`;
        toast.success(msg);
        setMergedJob({
          status: "completed",
          fileName,
          progress: null,
          liveStats: allSkippedStats,
          result: { success: true, message: msg, stats: allSkippedStats },
          errorMessage: null,
          startedAt: Date.now(),
          finishedAt: Date.now(),
        });
        setPopupVisible(true);
        mergedRunningRef.current = false;
        return;
      }

      const totalRows = effectiveRows.length;
      const totalChunks = Math.ceil(totalRows / MERGED_CHUNK_SIZE);

      const initialStats: MergedImportStats = {
        totalRows: rowsToImport.length,
        processed: 0,
        createdProducts: 0,
        updatedProducts: 0,
        skippedProducts: skippedCount,
        createdSites: 0,
        assignedWriters: 0,
        configuredLinks: 0,
        configuredGeos: 0,
        uniqueSites: [],
        errors: [],
      };

      setMergedJob({
        status: "running",
        fileName,
        progress: {
          currentChunk: 0,
          totalChunks,
          processedRows: 0,
          totalRows,
          percent: 0,
        },
        liveStats: initialStats,
        result: null,
        errorMessage: null,
        startedAt: Date.now(),
        finishedAt: null,
      });
      setPopupVisible(true);
      setPopupMinimized(false);

      const uniqueSitesSet = new Set<string>();
      const aggregated: MergedImportStats = { ...initialStats, errors: [] };

      try {
        let wasStopped = false;
        for (let i = 0; i < totalChunks; i++) {
          if (cancelMergedRef.current) {
            wasStopped = true;
            toast("Import stopped by user.", { icon: "⏸️" });
            break;
          }

          const chunk = effectiveRows.slice(i * MERGED_CHUNK_SIZE, (i + 1) * MERGED_CHUNK_SIZE);

          setMergedJob((prev) => ({
            ...prev,
            progress: {
              currentChunk: i + 1,
              totalChunks,
              processedRows: i * MERGED_CHUNK_SIZE,
              totalRows,
              percent: Math.round((i / totalChunks) * 100),
            },
          }));

          const effectiveChunkUpdateExisting = skipAlreadyImported ? true : updateExisting;

          const postChunk = async (subChunk: any[]): Promise<any> => {
            const res = await fetch("/api/admin/import-merged-sheet", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rows: subChunk,
                updateExisting: effectiveChunkUpdateExisting,
                skipCacheInvalidation: i < totalChunks - 1,
              }),
            });

            // On gateway timeout / bad gateway HTML response, automatically split chunk once into smaller sub-batches
            if (!res.ok && (res.status === 502 || res.status === 504 || res.status === 524) && subChunk.length > 8) {
              const mid = Math.ceil(subChunk.length / 2);
              const first = await postChunk(subChunk.slice(0, mid));
              const second = await postChunk(subChunk.slice(mid));
              const mergedStats = {
                totalRows: (first?.stats?.totalRows || 0) + (second?.stats?.totalRows || 0),
                processed: (first?.stats?.processed || 0) + (second?.stats?.processed || 0),
                createdProducts: (first?.stats?.createdProducts || 0) + (second?.stats?.createdProducts || 0),
                updatedProducts: (first?.stats?.updatedProducts || 0) + (second?.stats?.updatedProducts || 0),
                skippedProducts: (first?.stats?.skippedProducts || 0) + (second?.stats?.skippedProducts || 0),
                createdSites: (first?.stats?.createdSites || 0) + (second?.stats?.createdSites || 0),
                assignedWriters: (first?.stats?.assignedWriters || 0) + (second?.stats?.assignedWriters || 0),
                configuredLinks: (first?.stats?.configuredLinks || 0) + (second?.stats?.configuredLinks || 0),
                configuredGeos: (first?.stats?.configuredGeos || 0) + (second?.stats?.configuredGeos || 0),
                uniqueSites: Array.from(
                  new Set([...(first?.stats?.uniqueSites || []), ...(second?.stats?.uniqueSites || [])])
                ),
                errors: [...(first?.stats?.errors || []), ...(second?.stats?.errors || [])],
              };
              return { success: true, stats: mergedStats };
            }

            const parsed = await parseJsonResponseSafe(res, `Batch ${i + 1} failed`);
            if (!res.ok) {
              throw new Error(parsed.error || `Batch ${i + 1} failed (HTTP ${res.status})`);
            }
            return parsed;
          };

          const data = await postChunk(chunk);

          if (data.stats) {
            aggregated.processed += data.stats.processed || 0;
            aggregated.createdProducts += data.stats.createdProducts || 0;
            aggregated.updatedProducts += data.stats.updatedProducts || 0;
            aggregated.skippedProducts += data.stats.skippedProducts || 0;
            aggregated.createdSites += data.stats.createdSites || 0;
            aggregated.assignedWriters += data.stats.assignedWriters || 0;
            aggregated.configuredLinks += data.stats.configuredLinks || 0;
            aggregated.configuredGeos += data.stats.configuredGeos || 0;
            if (Array.isArray(data.stats.uniqueSites)) {
              data.stats.uniqueSites.forEach((s: string) => uniqueSitesSet.add(s));
            }
            if (Array.isArray(data.stats.errors)) {
              aggregated.errors.push(...data.stats.errors);
            }
          }

          const snapshot: MergedImportStats = {
            ...aggregated,
            uniqueSites: Array.from(uniqueSitesSet),
            errors: aggregated.errors.slice(0, 50),
          };

          setMergedJob((prev) => ({
            ...prev,
            progress: {
              currentChunk: i + 1,
              totalChunks,
              processedRows: Math.min((i + 1) * MERGED_CHUNK_SIZE, totalRows),
              totalRows,
              percent: Math.round(((i + 1) / totalChunks) * 100),
            },
            liveStats: snapshot,
          }));
        }

        const finalStats: MergedImportStats = {
          ...aggregated,
          uniqueSites: Array.from(uniqueSitesSet),
          errors: aggregated.errors.slice(0, 50),
        };

        const finalResult: MergedImportResult = {
          success: !wasStopped,
          message: wasStopped
            ? `Stopped after processing ${finalStats.processed} of ${totalRows} remaining rows across ${finalStats.uniqueSites.length} site(s).`
            : finalStats.skippedProducts > 0
            ? `Imported ${finalStats.processed} remaining rows across ${finalStats.uniqueSites.length} site(s) (skipped ${finalStats.skippedProducts} already-imported).`
            : `Successfully processed ${finalStats.processed} rows across ${finalStats.uniqueSites.length} site(s)!`,
          stats: finalStats,
        };

        setMergedJob((prev) => ({
          ...prev,
          status: wasStopped ? "stopped" : "completed",
          progress: null,
          liveStats: finalStats,
          result: finalResult,
          finishedAt: Date.now(),
        }));
        setPopupVisible(true);

        if (!wasStopped) {
          toast.success(`Import complete! ${finalStats.processed} rows processed.`);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app:data-imported", { detail: { type: "merged" } }));
        }
      } catch (err: any) {
        const msg = err?.message || "Failed to process import";
        toast.error(msg);
        const partialStats: MergedImportStats = {
          ...aggregated,
          uniqueSites: Array.from(uniqueSitesSet),
          errors: [...aggregated.errors, msg].slice(0, 50),
        };
        setMergedJob((prev) => ({
          ...prev,
          status: "error",
          progress: null,
          liveStats: partialStats,
          errorMessage: msg,
          result:
            aggregated.processed > 0
              ? {
                  success: false,
                  message: `Partially imported ${aggregated.processed} of ${totalRows} rows before error.`,
                  stats: partialStats,
                }
              : null,
          finishedAt: Date.now(),
        }));
        setPopupVisible(true);
      } finally {
        mergedRunningRef.current = false;
      }
    },
    []
  );

  const resetProductDraft = useCallback(() => {
    setProductDraft(INITIAL_PRODUCT_DRAFT);
    setProductJob((prev) => (prev.status === "running" ? prev : INITIAL_PRODUCT_JOB));
  }, []);

  const dismissProductJob = useCallback(() => {
    setProductJob((prev) => (prev.status === "running" ? prev : INITIAL_PRODUCT_JOB));
    if (mergedJob.status === "idle") {
      setPopupVisible(false);
      setPopupExpandedModal(false);
    }
  }, [mergedJob.status]);

  const startProductImport = useCallback(
    async ({
      fileName,
      products,
      userId,
    }: {
      fileName: string;
      products: any[];
      userId: string;
    }): Promise<ProductImportResult | null> => {
      if (productRunningRef.current) {
        toast("A product import is already running in the background.");
        setPopupVisible(true);
        setPopupMinimized(false);
        return null;
      }

      productRunningRef.current = true;
      setProductJob({
        status: "running",
        fileName,
        totalRows: products.length,
        result: null,
        errorMessage: null,
        startedAt: Date.now(),
        finishedAt: null,
      });
      setPopupVisible(true);
      setPopupMinimized(false);

      try {
        const res = await fetch("/api/products/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            products,
            addedById: userId,
          }),
        });

        const resData = await parseJsonResponseSafe(res, "Product import failed");
        if (!res.ok) throw new Error(resData.error || "Failed to import products");

        const result: ProductImportResult = {
          success: resData.success,
          importedCount: resData.importedCount,
          importedLinksCount: resData.importedLinksCount || 0,
          importedGeosCount: resData.importedGeosCount || 0,
          skippedCount: resData.skippedCount || 0,
          skipped: resData.skipped || [],
          errors: resData.errors || [],
        };

        setProductJob((prev) => ({
          ...prev,
          status: "completed",
          result,
          finishedAt: Date.now(),
        }));
        setPopupVisible(true);

        if (resData.importedCount > 0) {
          toast.success(
            `Imported ${resData.importedCount} new products successfully!${
              resData.skippedCount ? ` (${resData.skippedCount} duplicates skipped)` : ""
            }`
          );
        } else if (resData.skippedCount > 0) {
          toast.success(
            `Done: ${resData.skippedCount} products already exist in catalog (duplicates skipped).`
          );
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app:data-imported", { detail: { type: "products" } }));
        }

        return result;
      } catch (e: any) {
        const msg = e?.message || "Failed to import file";
        toast.error(msg);
        setProductJob((prev) => ({
          ...prev,
          status: "error",
          errorMessage: msg,
          finishedAt: Date.now(),
        }));
        setPopupVisible(true);
        return null;
      } finally {
        productRunningRef.current = false;
      }
    },
    []
  );

  return (
    <ImportContext.Provider
      value={{
        mergedDraft,
        setMergedDraft,
        resetMergedDraft,
        mergedJob,
        startMergedImport,
        stopMergedImport,
        dismissMergedJob,
        productDraft,
        setProductDraft,
        resetProductDraft,
        productJob,
        startProductImport,
        dismissProductJob,
        isProductModalOpen,
        setIsProductModalOpen,
        popupVisible,
        setPopupVisible,
        popupMinimized,
        setPopupMinimized,
        popupExpandedModal,
        setPopupExpandedModal,
      }}
    >
      {children}
    </ImportContext.Provider>
  );
}

export function useImport() {
  const ctx = useContext(ImportContext);
  if (!ctx) {
    throw new Error("useImport must be used inside ImportProvider");
  }
  return ctx;
}
