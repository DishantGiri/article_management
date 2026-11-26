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
    userId: number;
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

const MERGED_CHUNK_SIZE = 120;

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
    }: {
      fileName: string;
      rowsToImport: any[];
      updateExisting: boolean;
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

      const totalRows = rowsToImport.length;
      const totalChunks = Math.ceil(totalRows / MERGED_CHUNK_SIZE);

      const initialStats: MergedImportStats = {
        totalRows,
        processed: 0,
        createdProducts: 0,
        updatedProducts: 0,
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

          const chunk = rowsToImport.slice(i * MERGED_CHUNK_SIZE, (i + 1) * MERGED_CHUNK_SIZE);

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

          const res = await fetch("/api/admin/import-merged-sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rows: chunk,
              updateExisting,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || `Batch ${i + 1} failed (HTTP ${res.status})`);
          }

          if (data.stats) {
            aggregated.processed += data.stats.processed || 0;
            aggregated.createdProducts += data.stats.createdProducts || 0;
            aggregated.updatedProducts += data.stats.updatedProducts || 0;
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
            ? `Stopped after processing ${finalStats.processed} of ${totalRows} rows across ${finalStats.uniqueSites.length} site(s).`
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
      userId: number;
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

        const resData = await res.json();
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
