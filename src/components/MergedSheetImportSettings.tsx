/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef } from "react";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  FileText,
  Building2,
  Users,
  PenTool,
  Link2,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { cleanUrl, extractGeoLinksFromRow, isNullOrPlaceholder } from "@/lib/geo-link-parser";
import { extractThreeDatesFromRow, formatNoonUtcYmd, isDateColumnKey } from "@/lib/sheet-dates";
import { resolveAffiliateName } from "@/lib/import-resolvers";
import { useImport } from "@/context/ImportContext";

const EXPECTED_HEADERS = [
  "Product Name",
  "Linker Name",
  "Writer Name",
  "Article Link",
  "Bridge Page Link",
  "Affiliate Link",
  "Site Name",
  "Added Date",
  "Affiliate Network",
  "Category",
  "Article Status",
  "Publish Date",
  "Link Status",
  "Product Type",
  "Preview Link",
  "Remarks",
  "Trends",
  "GEO",
  "Linker Notes",
  "Affiliate Link 2",
  "Affiliate Link 3",
  "Article Link EN",
  "Article Link DE",
  "Article Link FR",
  "Article Link ES",
  "Article Link IT",
  "Article Link NL",
  "Article Link SV",
  "Article Link FI",
  "Link 3",
  "Link 4",
];

function splitPersonNames(raw: string): string[] {
  if (!raw) return [];
  const cleaned = raw.replace(/^["'\s]+|["'\s]+$/g, "").trim();
  const lower = cleaned.toLowerCase();
  if (
    [
      "n/a",
      "na",
      "n / a",
      "nil",
      "none",
      "unassigned",
      "-",
      "--",
      "---",
      "anonymous",
      "blank",
      "null",
      "undefined",
    ].includes(lower)
  ) {
    return [];
  }
  const parts = cleaned.split(/,|\s+and\s+|\s*&\s*|\s*\+\s*|\s*\/\s*/i);
  return parts
    .map((p) => p.trim().replace(/^["']+|["']+$/g, ""))
    .filter(
      (p) =>
        p.length > 0 &&
        ![
          "n/a",
          "na",
          "n / a",
          "nil",
          "none",
          "unassigned",
          "-",
          "--",
          "---",
          "anonymous",
          "blank",
          "null",
          "undefined",
        ].includes(p.toLowerCase())
    );
}

function normalizeCellKey(k: string): string {
  return String(k || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function findRowVal(row: any, ...aliases: string[]): any {
  const normSet = new Set(aliases.map(normalizeCellKey));
  for (const k of Object.keys(row || {})) {
    if (normSet.has(normalizeCellKey(k))) {
      const val = row[k];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return val;
      }
    }
  }
  return "";
}

function extractPreviewGeos(row: any): Array<{ geo: string; affiliateLink: string }> {
  return extractGeoLinksFromRow(row, "Standard").geoLinks.map((g) => ({
    geo: g.geo,
    affiliateLink: g.affiliateLink,
  }));
}

export default function MergedSheetImportSettings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    mergedDraft,
    setMergedDraft,
    resetMergedDraft,
    mergedJob,
    startMergedImport,
    stopMergedImport,
    setPopupVisible,
    setPopupMinimized,
  } = useImport();
  const [isParsing, setIsParsing] = useState(false);

  const selectedFileName = mergedDraft.fileName;
  const sheetNames = mergedDraft.sheetNames;
  const activeSheetTab = mergedDraft.activeSheetTab;
  const importScope = mergedDraft.importScope;
  const allParsedRows = mergedDraft.allParsedRows;
  const updateExisting = mergedDraft.updateExisting;
  const searchQuery = mergedDraft.searchQuery;

  const isImporting = mergedJob.status === "running";
  const importProgress = mergedJob.progress;
  const importResult = mergedJob.result;

  const setActiveSheetTab = (tab: string) =>
    setMergedDraft((prev) => ({ ...prev, activeSheetTab: tab }));
  const setImportScope = (scope: "ALL" | "ACTIVE") =>
    setMergedDraft((prev) => ({ ...prev, importScope: scope }));
  const setUpdateExisting = (val: boolean) =>
    setMergedDraft((prev) => ({ ...prev, updateExisting: val }));
  const setSearchQuery = (q: string) =>
    setMergedDraft((prev) => ({ ...prev, searchQuery: q }));

  // Generate and Download Sample Excel Template
  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Tab 1: Daily Health Supplement
      const sampleRowsSite1 = [
        {
          "Product Name": "Creatine Monohydrate 500g",
          "Linker Name": "Muna",
          "Writer Name": "Rahil",
          "Article Link": "https://docs.google.com/document/d/sample-creatine",
          "Bridge Page Link": "https://dailyhealthsupplement.com/creatine",
          "Affiliate Link": "https://hop.clickbank.net/?affiliate=test&tid=dhs",
          "Site Name": "Daily Health Supplement",
          "Added Date": "2026-11-01",
          "Affiliate Network": "ClickBank",
          "Product Type": "Nutra",
          "Category": "Dietary Supplements",
          "Article Status": "APPROVED",
          "Publish Date": "2026-11-03",
          "Link Status": "ACCEPTED",
          "Preview Link": "",
          "Remarks": "",
          "Trends": "HIGH",
          "GEO": "US, UK",
          "Linker Notes": "",
          "Affiliate Link 2": "",
          "Affiliate Link 3": "",
          "Article Link EN": "",
          "Article Link DE": "",
          "Article Link FR": "",
          "Article Link ES": "",
          "Article Link IT": "",
          "Article Link NL": "",
          "Article Link SV": "",
          "Article Link FI": "",
          "Link 3": "",
          "Link 4": "",
        },
        {
          "Product Name": "Alpha Whey Protein",
          "Linker Name": "Rahul Gupta",
          "Writer Name": "Sujima",
          "Article Link": "https://docs.google.com/document/d/sample-alpha-whey",
          "Bridge Page Link": "https://dailyhealthsupplement.com/alpha-whey",
          "Affiliate Link": "https://smashload.com/track/alpha-whey",
          "Site Name": "Daily Health Supplement",
          "Added Date": "2026-11-02",
          "Affiliate Network": "Smash Loud",
          "Product Type": "Nutra",
          "Category": "Supplements",
          "Article Status": "IN_PROGRESS",
          "Publish Date": "NA",
          "Link Status": "REQUESTED",
          "Preview Link": "",
          "Remarks": "",
          "Trends": "MODERATE",
          "GEO": "US",
          "Linker Notes": "",
          "Affiliate Link 2": "",
          "Affiliate Link 3": "",
          "Article Link EN": "",
          "Article Link DE": "",
          "Article Link FR": "",
          "Article Link ES": "",
          "Article Link IT": "",
          "Article Link NL": "",
          "Article Link SV": "",
          "Article Link FI": "",
          "Link 3": "",
          "Link 4": "",
        },
      ];

      // Tab 2: Guru Review Club
      const sampleRowsSite2 = [
        {
          "Product Name": "Puravive Exotic Rice Method",
          "Linker Name": "Muna",
          "Writer Name": "Ayush",
          "Article Link": "https://docs.google.com/document/d/sample-puravive",
          "Bridge Page Link": "https://gurureviewclub.com/puravive",
          "Affiliate Link": "https://hop.clickbank.net/?affiliate=test&tid=grc",
          "Site Name": "Guru Review Club",
          "Added Date": "2026-11-04",
          "Affiliate Network": "ClickBank",
          "Product Type": "Nutra",
          "Category": "Weight Loss",
          "Article Status": "COMPLETED",
          "Publish Date": "2026-11-06",
          "Link Status": "ACCEPTED",
          "Preview Link": "",
          "Remarks": "",
          "Trends": "HIGH",
          "GEO": "US, UK, CA",
          "Linker Notes": "",
          "Affiliate Link 2": "",
          "Affiliate Link 3": "",
          "Article Link EN": "",
          "Article Link DE": "",
          "Article Link FR": "",
          "Article Link ES": "",
          "Article Link IT": "",
          "Article Link NL": "",
          "Article Link SV": "",
          "Article Link FI": "",
          "Link 3": "",
          "Link 4": "",
        },
      ];

      // Tab 3: Supplement Mag
      const sampleRowsSite3 = [
        {
          "Product Name": "SphereFresh Fridge Deodoriser",
          "Linker Name": "Pratiksha",
          "Writer Name": "Bibek",
          "Article Link": "https://docs.google.com/document/d/sample-spherefresh",
          "Bridge Page Link": "https://supplementmag.com/spherefresh",
          "Affiliate Link": "https://mediascalers.com/offer/spherefresh",
          "Site Name": "Supplement Mag",
          "Added Date": "2026-11-01",
          "Affiliate Network": "Media Scalers",
          "Product Type": "Ecom",
          "Category": "Miscellaneous",
          "Article Status": "COMPLETED",
          "Publish Date": "2026-11-04",
          "Link Status": "ACCEPTED",
          "Preview Link": "",
          "Remarks": "",
          "Trends": "HIGH",
          "GEO": "US",
          "Linker Notes": "",
          "Affiliate Link 2": "",
          "Affiliate Link 3": "",
          "Article Link EN": "",
          "Article Link DE": "",
          "Article Link FR": "",
          "Article Link ES": "",
          "Article Link IT": "",
          "Article Link NL": "",
          "Article Link SV": "",
          "Article Link FI": "",
          "Link 3": "",
          "Link 4": "",
        },
      ];

      // Tab 4: The Buyers Reviews
      const sampleRowsSite4 = [
        {
          "Product Name": "ProDentim Advanced Oral Health",
          "Linker Name": "Anjali",
          "Writer Name": "Rahil",
          "Article Link": "https://docs.google.com/document/d/sample-prodentim",
          "Bridge Page Link": "https://thebuyersreviews.com/prodentim",
          "Affiliate Link": "https://buygoods.com/affiliate/prodentim",
          "Site Name": "The Buyers Reviews",
          "Added Date": "2026-11-03",
          "Affiliate Network": "Buy Goods",
          "Product Type": "Nutra",
          "Category": "Dental health",
          "Article Status": "APPROVED",
          "Publish Date": "2026-11-05",
          "Link Status": "ACCEPTED",
          "Preview Link": "",
          "Remarks": "",
          "Trends": "HIGH",
          "GEO": "US, UK",
          "Linker Notes": "",
          "Affiliate Link 2": "",
          "Affiliate Link 3": "",
          "Article Link EN": "",
          "Article Link DE": "",
          "Article Link FR": "",
          "Article Link ES": "",
          "Article Link IT": "",
          "Article Link NL": "",
          "Article Link SV": "",
          "Article Link FI": "",
          "Link 3": "",
          "Link 4": "",
        },
      ];

      // Sheet 1: Daily Health Supplement
      const ws1 = XLSX.utils.json_to_sheet(sampleRowsSite1, { header: EXPECTED_HEADERS });
      XLSX.utils.book_append_sheet(wb, ws1, "Daily Health Supplement");

      // Sheet 2: Guru Review Club
      const ws2 = XLSX.utils.json_to_sheet(sampleRowsSite2, { header: EXPECTED_HEADERS });
      XLSX.utils.book_append_sheet(wb, ws2, "Guru Review Club");

      // Sheet 3: Supplement Mag
      const ws3 = XLSX.utils.json_to_sheet(sampleRowsSite3, { header: EXPECTED_HEADERS });
      XLSX.utils.book_append_sheet(wb, ws3, "Supplement Mag");

      // Sheet 4: The Buyers Reviews
      const ws4 = XLSX.utils.json_to_sheet(sampleRowsSite4, { header: EXPECTED_HEADERS });
      XLSX.utils.book_append_sheet(wb, ws4, "The Buyers Reviews");

      XLSX.writeFile(wb, "Merged_Data_Sheet_Template.xlsx");
      toast.success("Downloaded sample Excel template!");
    } catch (e: any) {
      toast.error("Failed to generate template: " + e.message);
    }
  };

  // Handle File Upload and Client-side Parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setMergedDraft((prev) => ({
      ...prev,
      fileName: file.name,
    }));

    try {
      const [XLSX, buffer] = await Promise.all([import("xlsx"), file.arrayBuffer()]);
      // Read with cellDates: false to prevent SheetJS timezone shifting on Excel native dates
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });

      const detectedSheets: string[] = [];
      const parsedRows: any[] = [];

      for (const name of workbook.SheetNames) {
        const clean = name.trim().toLowerCase();
        if (clean === "readme" || clean === "instructions" || clean === "guide" || clean === "summary") {
          continue;
        }
        detectedSheets.push(name);

        const sheet = workbook.Sheets[name];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        for (let idx = 0; idx < rows.length; idx++) {
          const rawRow = rows[idx];
          const normalizedRow: Record<string, any> = {};

          // Normalize Excel serial dates on date columns into exact YYYY-MM-DD strings
          for (const k of Object.keys(rawRow)) {
            const val = rawRow[k];
            if (isDateColumnKey(k) && typeof val === "number" && Number.isFinite(val)) {
              const dc = XLSX.SSF.parse_date_code(val);
              if (dc && dc.y >= 1900) {
                const mm = String(dc.m).padStart(2, "0");
                const dd = String(dc.d).padStart(2, "0");
                normalizedRow[k] = `${dc.y}-${mm}-${dd}`;
                continue;
              }
            }
            normalizedRow[k] = val;
          }

          const prodName = String(
            findRowVal(normalizedRow, "Product Name", "Product", "Title", "Name") || ""
          ).trim();

          if (!prodName || isNullOrPlaceholder(prodName)) continue;

          // If no site name in row, default to tab name
          const site = String(
            findRowVal(normalizedRow, "Site Name", "Site", "Website", "Sitename") || name
          ).trim();

          const linkerName = String(
            findRowVal(normalizedRow, "Linker Name", "Linker", "Researched By", "Researcher") || ""
          ).trim();
          const writerName = String(
            findRowVal(normalizedRow, "Writer Name", "Writer", "Author") || ""
          ).trim();

          parsedRows.push({
            ...normalizedRow,
            __sheetName: name,
            __rowId: `${name}_${idx}`,
            "Product Name": prodName,
            "Site Name": site,
            ...(linkerName && !normalizedRow["Linker Name"] ? { "Linker Name": linkerName } : {}),
            ...(writerName && !normalizedRow["Writer Name"] ? { "Writer Name": writerName } : {}),
          });
        }
      }

      setMergedDraft((prev) => ({
        ...prev,
        fileName: file.name,
        sheetNames: detectedSheets,
        allParsedRows: parsedRows,
        activeSheetTab: "ALL",
      }));

      if (parsedRows.length === 0) {
        toast.error("No valid product rows found in this sheet.");
      } else {
        toast.success(`Loaded ${parsedRows.length} rows across ${detectedSheets.length} sheet tabs!`);
      }
    } catch (err: any) {
      toast.error("Failed to parse sheet: " + err.message);
    } finally {
      setIsParsing(false);
    }
  };

  // Filter rows based on active tab and search query
  const displayedRows = allParsedRows.filter((row) => {
    if (activeSheetTab !== "ALL" && row.__sheetName !== activeSheetTab && row["Site Name"] !== activeSheetTab) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchProd = (row["Product Name"] || "").toLowerCase().includes(q);
      const matchSite = (row["Site Name"] || "").toLowerCase().includes(q);
      const matchLinker = (row["Linker Name"] || "").toLowerCase().includes(q);
      const matchWriter = (row["Writer Name"] || "").toLowerCase().includes(q);
      return matchProd || matchSite || matchLinker || matchWriter;
    }
    return true;
  });

  // Calculate Summary KPIs (splits combined "name, name" strings)
  const uniqueProductsCount = new Set(allParsedRows.map((r) => r["Product Name"])).size;
  const uniqueSitesCount = new Set(allParsedRows.map((r) => r["Site Name"])).size;
  const uniqueLinkersCount = new Set(
    allParsedRows.flatMap((r) => splitPersonNames(r["Linker Name"] || ""))
  ).size;
  const uniqueWritersCount = new Set(
    allParsedRows.flatMap((r) => splitPersonNames(r["Writer Name"] || ""))
  ).size;

  const handleCancelImport = () => {
    stopMergedImport();
  };

  const handleExecuteImport = async () => {
    if (!selectedFileName || allParsedRows.length === 0) {
      toast.error("Please choose a valid spreadsheet first.");
      return;
    }

    const rowsToImport =
      importScope === "ACTIVE" && activeSheetTab !== "ALL"
        ? allParsedRows.filter(
            (r) => r.__sheetName === activeSheetTab || r["Site Name"] === activeSheetTab
          )
        : allParsedRows;

    if (rowsToImport.length === 0) {
      toast.error("No valid rows found in the selected scope.");
      return;
    }

    setPopupVisible(true);
    setPopupMinimized(false);
    await startMergedImport({
      fileName: selectedFileName,
      rowsToImport,
      updateExisting,
    });
  };

  const handleReset = () => {
    resetMergedDraft();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Super Admin Tool</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Import Merged Data Sheet
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Import products, linkers, writers, article links, bridge page links, and affiliate networks in bulk.
              Supports unified single-sheet workbooks as well as multi-tab spreadsheets where each tab corresponds to a site.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-[0.98] border border-white/20 text-white font-bold text-xs transition flex items-center gap-2 shrink-0 cursor-pointer shadow-xs self-start sm:self-auto"
            title="Download an Excel template pre-formatted with all required columns and sample site tabs"
          >
            <Download className="w-4 h-4 text-indigo-300" />
            <span>Download Sample Template (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Upload Zone & Instructions */}
      {!selectedFileName && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-indigo-300 dark:border-indigo-800/60 hover:border-indigo-500 dark:hover:border-indigo-600 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 group flex flex-col items-center justify-center gap-3"
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
              <Upload className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                Click to upload or drag & drop your Excel or CSV file
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Supports .xlsx, .xls, and .csv files with single or multiple site sheets
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-3.5 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 shadow-2xs mt-2">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Multi-Tab & Merged Sheet Detection Supported</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Expected Columns Reference */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Expected Column Headers
              </span>
              <span className="text-[11px] text-slate-400">
                Matches spreadsheet order
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXPECTED_HEADERS.map((h, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Parsing Loader */}
      {isParsing && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-bold text-slate-800 dark:text-white">
            Reading and parsing spreadsheet workbook...
          </p>
        </div>
      )}

      {/* Parsed Preview & Import Options */}
      {selectedFileName && !isParsing && (
        <div className="space-y-6">
          {/* File Card & KPI Summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {selectedFileName}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {allParsedRows.length} valid rows found across {sheetNames.length} sheet tab(s)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleReset}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Change File
                </button>
              </div>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Rows
                </span>
                <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5 block">
                  {allParsedRows.length}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">
                  Unique Products
                </span>
                <span className="text-xl font-black text-blue-700 dark:text-blue-300 mt-0.5 block">
                  {uniqueProductsCount}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40">
                <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">
                  Target Sites
                </span>
                <span className="text-xl font-black text-purple-700 dark:text-purple-300 mt-0.5 block">
                  {uniqueSitesCount}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">
                  Writers / Linkers
                </span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                  {uniqueWritersCount} / {uniqueLinkersCount}
                </span>
              </div>
            </div>

            {/* Import Configuration Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded mt-0.5 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-white block">
                    Update existing products & link logs
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    If a product already exists on the site, update its links, article status, and writer.
                  </span>
                </div>
              </label>

              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-start gap-2.5">
                <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">
                    User Matching Only (No Auto-Create)
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Matches existing registered Linkers & Writers by name. Unrecognized names are left unassigned.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sheet Tabs Bar (Matching Image 2) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Workbook Site Tabs
                </span>
                <span className="text-[11px] text-slate-400">
                  Click a tab to view rows parsed for that specific site
                </span>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, sites, writers..."
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:w-64"
              />
            </div>

            {/* Horizontal Scrollable Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setActiveSheetTab("ALL")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                  activeSheetTab === "ALL"
                    ? "bg-[#6D8196] text-white shadow-2xs font-extrabold"
                    : "bg-[#FAF9F5] text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                All Sheets (Merged) ({allParsedRows.length})
              </button>

              {sheetNames.map((tab) => {
                const count = allParsedRows.filter(
                  (r) => r.__sheetName === tab || r["Site Name"] === tab
                ).length;
                const isActive = activeSheetTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveSheetTab(tab)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                      isActive
                        ? "bg-[#6D8196] text-white shadow-2xs font-extrabold"
                        : "bg-[#FAF9F5] text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    }`}
                  >
                    <span>{tab}</span>
                    <span className="ml-1.5 opacity-60 text-[10px]">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Preview Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Site Name</th>
                    <th className="py-2.5 px-3">Linker</th>
                    <th className="py-2.5 px-3">Writer</th>
                    <th className="py-2.5 px-3">Network</th>
                    <th className="py-2.5 px-3">Article Status</th>
                    <th className="py-2.5 px-3">Link Status</th>
                    <th className="py-2.5 px-3">Dates</th>
                    <th className="py-2.5 px-3">Links Preview</th>
                    <th className="py-2.5 px-3">GEO Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {displayedRows.slice(0, 25).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {row["Product Name"]}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                          {row["Site Name"]}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {String(findRowVal(row, "Linker Name", "Linker", "Researched By", "Researcher") || "—")}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {String(findRowVal(row, "Writer Name", "Writer", "Author") || "Unassigned")}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {resolveAffiliateName(
                          String(findRowVal(row, "Affiliate Network", "Network", "Affiliate") || "")
                        ) || "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                          {String(findRowVal(row, "Article Status", "Status") || "PENDING")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                          {String(findRowVal(row, "Link Status") || "REQUESTED")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-[10px]">
                        {(() => {
                          const d = extractThreeDatesFromRow(row);
                          const addStr = formatNoonUtcYmd(d.addedDate);
                          const writeStr = formatNoonUtcYmd(d.writeDate);
                          const pubStr = formatNoonUtcYmd(d.publishDate);
                          if (!addStr && !writeStr && !pubStr) {
                            return <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>;
                          }
                          return (
                            <div className="flex flex-col gap-0.5 font-mono">
                              {addStr && <span className="text-slate-600 dark:text-slate-300">Add: {addStr}</span>}
                              {writeStr && <span className="text-indigo-600 dark:text-indigo-400">Wrt: {writeStr}</span>}
                              {pubStr && <span className="text-emerald-600 dark:text-emerald-400">Pub: {pubStr}</span>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                        {(() => {
                          const artUrl = cleanUrl(
                            findRowVal(
                              row,
                              "Article Link",
                              "Article URL",
                              "Article Link EN",
                              "Article Link DE",
                              "Article Link FR",
                              "Article Link ES",
                              "Article Link IT",
                              "Article Link NL",
                              "Article Link SV",
                              "Article Link FI"
                            )
                          );
                          const buyUrl = cleanUrl(
                            findRowVal(row, "Buy Link", "Buy Now Link", "Buy Now", "Direct Buy Link", "Landing Link", "Bridge Page Link", "Bridgepage Link", "Bridge Link", "Bridge URL", "Bridge")
                          );
                          const affUrl = cleanUrl(
                            findRowVal(row, "Affiliate Link", "Affiliate URL", "Offer Link", "Affiliate Link 2", "Affiliate Link 3", "Link 3", "Link 4")
                          );
                          const prevUrl = cleanUrl(findRowVal(row, "Preview Link", "Preview URL", "Preview"));
                          if (!artUrl && !buyUrl && !affUrl && !prevUrl) {
                            return <span className="text-slate-300 dark:text-slate-600 font-mono text-[10px]">—</span>;
                          }
                          return (
                            <div className="flex items-center gap-2">
                              {artUrl && (
                                <span title={`Article: ${artUrl}`} className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                                  <FileText className="w-3 h-3" />
                                  <span>Article</span>
                                </span>
                              )}
                              {buyUrl && (
                                <span
                                  title={`Buy Now: ${buyUrl}`}
                                  className="text-purple-600 dark:text-purple-400 flex items-center gap-0.5 font-bold"
                                >
                                  <Link2 className="w-3 h-3" />
                                  <span>Buy Now</span>
                                </span>
                              )}
                              {affUrl && (
                                <span title={`Affiliate: ${affUrl}`} className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Affiliate</span>
                                </span>
                              )}
                              {prevUrl && (
                                <span title={`Preview: ${prevUrl}`} className="text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Preview</span>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {(() => {
                          const previewGeos = extractPreviewGeos(row);
                          if (previewGeos.length === 0) {
                            return <span className="text-slate-300 dark:text-slate-600 font-mono text-[10px]">—</span>;
                          }
                          return (
                            <div className="flex flex-wrap gap-1 items-center max-w-[160px]">
                              {previewGeos.map((g) => (
                                <span
                                  key={g.geo}
                                  title={`${g.geo}: ${g.affiliateLink}`}
                                  className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold"
                                >
                                  {g.geo}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {displayedRows.length > 25 && (
                <div className="p-2.5 text-center bg-slate-50 dark:bg-slate-800/40 text-slate-400 text-xs font-semibold">
                  Showing first 25 of {displayedRows.length} rows in this view.
                </div>
              )}
            </div>

            {/* Scope Selection (All Sheets vs Active Tab) */}
            {activeSheetTab !== "ALL" && (
              <div className="flex flex-wrap items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Import Scope:</span>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="radio"
                    name="importScope"
                    value="ALL"
                    checked={importScope === "ALL"}
                    onChange={() => setImportScope("ALL")}
                    className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>All Tabs ({allParsedRows.length} total rows)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="radio"
                    name="importScope"
                    value="ACTIVE"
                    checked={importScope === "ACTIVE"}
                    onChange={() => setImportScope("ACTIVE")}
                    className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Active Tab Only: <strong className="text-indigo-600 dark:text-indigo-400">{activeSheetTab}</strong> ({displayedRows.length} rows)</span>
                </label>
              </div>
            )}

            {/* Live Chunked Batch Progress Indicator */}
            {isImporting && importProgress && (
              <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 space-y-3 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-white">
                      Processing Batch {importProgress.currentChunk} of {importProgress.totalChunks}...
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      (Chunked 120 rows/req to prevent timeouts)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono text-sm">
                      {importProgress.percent}% ({importProgress.processedRows} / {importProgress.totalRows} rows)
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelImport}
                      className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-[11px] transition cursor-pointer"
                    >
                      Stop
                    </button>
                  </div>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${importProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Ready to import <strong>{importScope === "ACTIVE" && activeSheetTab !== "ALL" ? displayedRows.length : allParsedRows.length}</strong> items into database via fast chunks
              </span>

              <button
                type="button"
                disabled={isImporting || allParsedRows.length === 0}
                onClick={handleExecuteImport}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing in Batches...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Import {importScope === "ACTIVE" && activeSheetTab !== "ALL" ? displayedRows.length : allParsedRows.length} Rows</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Import Results Card */}
          {importResult && (
            <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800/80 rounded-3xl p-6 space-y-4 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Import Succeeded!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {importResult.message}
                  </p>
                </div>
              </div>

              {/* Stats breakdown */}
              {importResult.stats && (
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 text-[10px] font-bold uppercase block">New Products</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {importResult.stats.createdProducts}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 text-[10px] font-bold uppercase block">Updated Products</span>
                    <span className="text-base font-black text-blue-600 dark:text-blue-400">
                      {importResult.stats.updatedProducts}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 text-[10px] font-bold uppercase block">Writers Assigned</span>
                    <span className="text-base font-black text-purple-600 dark:text-purple-400">
                      {importResult.stats.assignedWriters}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 text-[10px] font-bold uppercase block">Links Saved</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                      {importResult.stats.configuredLinks}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 text-[10px] font-bold uppercase block">GEO Links</span>
                    <span className="text-base font-black text-teal-600 dark:text-teal-400">
                      {importResult.stats.configuredGeos || 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 text-[10px] font-bold uppercase block">Sites Covered</span>
                    <span className="text-base font-black text-amber-600 dark:text-amber-400">
                      {importResult.stats.uniqueSites?.length || 0}
                    </span>
                  </div>
                </div>
              )}

              {importResult.stats?.errors && importResult.stats.errors.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Import Warnings ({importResult.stats.errors.length})</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-amber-700 dark:text-amber-300 text-[11px]">
                    {importResult.stats.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

