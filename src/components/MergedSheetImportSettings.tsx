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
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
} from "lucide-react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";

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
];

export default function MergedSheetImportSettings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelImportRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetTab, setActiveSheetTab] = useState<string>("ALL");
  const [importScope, setImportScope] = useState<"ALL" | "ACTIVE">("ALL");
  const [allParsedRows, setAllParsedRows] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    currentChunk: number;
    totalChunks: number;
    processedRows: number;
    totalRows: number;
    percent: number;
  } | null>(null);
  const [createMissingUsers, setCreateMissingUsers] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importResult, setImportResult] = useState<any | null>(null);

  // Search/Filter in Preview
  const [searchQuery, setSearchQuery] = useState("");

  // Generate and Download Sample Excel Template
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      const sampleRowsSite1 = [
        {
          "Product Name": "Creatine Monohydrate 500g",
          "Linker Name": "Muna Pun",
          "Writer Name": "Rahil Kunwar",
          "Article Link": "https://docs.google.com/document/d/sample1",
          "Bridge Page Link": "https://dailyhealthsupplement.com/creatine",
          "Affiliate Link": "https://hop.clickbank.net/?affiliate=test&tid=dhs",
          "Site Name": "Daily Health Supplement",
          "Added Date": "2026-11-01",
          "Affiliate Network": "ClickBank",
          "Category": "Nutra",
          "Article Status": "APPROVED",
          "Publish Date": "2026-11-03",
          "Link Status": "ACCEPTED",
        },
        {
          "Product Name": "Alpha Whey Protein",
          "Linker Name": "Sandesh",
          "Writer Name": "Aayusha Adhikari",
          "Article Link": "https://docs.google.com/document/d/sample2",
          "Bridge Page Link": "https://dailyhealthsupplement.com/alpha-whey",
          "Affiliate Link": "https://smashload.com/track/alpha-whey",
          "Site Name": "Daily Health Supplement",
          "Added Date": "2026-11-02",
          "Affiliate Network": "Smashload",
          "Category": "Supplements",
          "Article Status": "IN_PROGRESS",
          "Publish Date": "",
          "Link Status": "REQUESTED",
        },
      ];

      const sampleRowsSite2 = [
        {
          "Product Name": "SphereFresh Fridge Deodoriser",
          "Linker Name": "Muna Pun",
          "Writer Name": "Rahil Kunwar",
          "Article Link": "https://docs.google.com/document/d/sample3",
          "Bridge Page Link": "https://supplementmag.com/spherefresh",
          "Affiliate Link": "https://mediascalers.com/offer/spherefresh",
          "Site Name": "Supplement Mag",
          "Added Date": "2026-11-01",
          "Affiliate Network": "Mediascalers",
          "Category": "Ecom",
          "Article Status": "COMPLETED",
          "Publish Date": "2026-11-04",
          "Link Status": "ACCEPTED",
        },
      ];

      // Sheet 1: Daily Health Supplement
      const ws1 = XLSX.utils.json_to_sheet(sampleRowsSite1, { header: EXPECTED_HEADERS });
      XLSX.utils.book_append_sheet(wb, ws1, "Daily Health Supplement");

      // Sheet 2: SupplementMag
      const ws2 = XLSX.utils.json_to_sheet(sampleRowsSite2, { header: EXPECTED_HEADERS });
      XLSX.utils.book_append_sheet(wb, ws2, "SupplementMag");

      // Sheet 3: TheBuyersReviews
      const ws3 = XLSX.utils.json_to_sheet([], { header: EXPECTED_HEADERS });
      XLSX.utils.book_append_sheet(wb, ws3, "TheBuyersReviews");

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

    setSelectedFile(file);
    setIsParsing(true);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

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
          const row = rows[idx];
          const prodName = (
            row["Product Name"] ||
            row["product_name"] ||
            row["ProductName"] ||
            row["Title"] ||
            row["name"] ||
            ""
          ).trim();

          if (!prodName) continue;

          // If no site name in row, default to tab name
          const site = (
            row["Site Name"] ||
            row["site_name"] ||
            row["Site"] ||
            row["Website"] ||
            name
          ).trim();

          parsedRows.push({
            ...row,
            __sheetName: name,
            __rowId: `${name}_${idx}`,
            "Product Name": prodName,
            "Site Name": site,
          });
        }
      }

      setSheetNames(detectedSheets);
      setAllParsedRows(parsedRows);
      setActiveSheetTab("ALL");

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

  // Calculate Summary KPIs
  const uniqueProductsCount = new Set(allParsedRows.map((r) => r["Product Name"])).size;
  const uniqueSitesCount = new Set(allParsedRows.map((r) => r["Site Name"])).size;
  const uniqueLinkersCount = new Set(
    allParsedRows.map((r) => r["Linker Name"]).filter((x) => x && x.trim() && x.toLowerCase() !== "unassigned")
  ).size;
  const uniqueWritersCount = new Set(
    allParsedRows.map((r) => r["Writer Name"]).filter((x) => x && x.trim() && x.toLowerCase() !== "unassigned")
  ).size;

  // Execute Chunked Batch Import to prevent 504 Gateway Timeouts
  const CHUNK_SIZE = 120;

  const handleCancelImport = () => {
    cancelImportRef.current = true;
  };

  const handleExecuteImport = async () => {
    if (!selectedFile || allParsedRows.length === 0) {
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

    setIsImporting(true);
    setImportResult(null);
    cancelImportRef.current = false;

    const totalRows = rowsToImport.length;
    const totalChunks = Math.ceil(totalRows / CHUNK_SIZE);

    setImportProgress({
      currentChunk: 0,
      totalChunks,
      processedRows: 0,
      totalRows,
      percent: 0,
    });

    const aggregatedStats = {
      totalRows,
      processed: 0,
      createdProducts: 0,
      updatedProducts: 0,
      createdUsers: 0,
      createdSites: 0,
      assignedWriters: 0,
      configuredLinks: 0,
      uniqueSites: new Set<string>(),
      errors: [] as string[],
    };

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (cancelImportRef.current) {
          toast("Import stopped by user.", { icon: "⏸️" });
          break;
        }

        const chunk = rowsToImport.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

        setImportProgress({
          currentChunk: i + 1,
          totalChunks,
          processedRows: i * CHUNK_SIZE,
          totalRows,
          percent: Math.round((i / totalChunks) * 100),
        });

        const res = await fetch("/api/admin/import-merged-sheet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rows: chunk,
            createMissingUsers,
            updateExisting,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Batch ${i + 1} failed (HTTP ${res.status})`);
        }

        if (data.stats) {
          aggregatedStats.processed += data.stats.processed || 0;
          aggregatedStats.createdProducts += data.stats.createdProducts || 0;
          aggregatedStats.updatedProducts += data.stats.updatedProducts || 0;
          aggregatedStats.createdUsers += data.stats.createdUsers || 0;
          aggregatedStats.createdSites += data.stats.createdSites || 0;
          aggregatedStats.assignedWriters += data.stats.assignedWriters || 0;
          aggregatedStats.configuredLinks += data.stats.configuredLinks || 0;
          if (Array.isArray(data.stats.uniqueSites)) {
            data.stats.uniqueSites.forEach((s: string) => aggregatedStats.uniqueSites.add(s));
          }
          if (Array.isArray(data.stats.errors)) {
            aggregatedStats.errors.push(...data.stats.errors);
          }
        }

        setImportProgress({
          currentChunk: i + 1,
          totalChunks,
          processedRows: Math.min((i + 1) * CHUNK_SIZE, totalRows),
          totalRows,
          percent: Math.round(((i + 1) / totalChunks) * 100),
        });
      }

      setImportResult({
        success: true,
        message: `Successfully processed ${aggregatedStats.processed} rows across ${aggregatedStats.uniqueSites.size} site(s)!`,
        stats: {
          ...aggregatedStats,
          uniqueSites: Array.from(aggregatedStats.uniqueSites),
          errors: aggregatedStats.errors.slice(0, 50),
        },
      });
      toast.success(`Import complete! ${aggregatedStats.processed} rows processed.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to process import");
      if (aggregatedStats.processed > 0) {
        setImportResult({
          success: false,
          message: `Partially imported ${aggregatedStats.processed} of ${totalRows} rows before error.`,
          stats: {
            ...aggregatedStats,
            uniqueSites: Array.from(aggregatedStats.uniqueSites),
            errors: [...aggregatedStats.errors, err.message].slice(0, 50),
          },
        });
      }
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSheetNames([]);
    setAllParsedRows([]);
    setImportResult(null);
    setImportProgress(null);
    cancelImportRef.current = false;
    setSearchQuery("");
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
      {!selectedFile && (
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
              <Sparkles className="w-3.5 h-3.5" />
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
                Expected Column Headers (Image 1)
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
      {selectedFile && !isParsing && (
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
                    {selectedFile.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {allParsedRows.length} valid rows found across {sheetNames.length} sheet tab(s)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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

            {/* Import Configuration Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition">
                <input
                  type="checkbox"
                  checked={createMissingUsers}
                  onChange={(e) => setCreateMissingUsers(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded mt-0.5 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-white block">
                    Auto-create missing Linker & Writer users
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    If a person named in the sheet does not exist in the database, automatically register them.
                  </span>
                </div>
              </label>

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
            </div>
          </div>

          {/* Sheet Tabs Bar (Matching Image 2) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Workbook Site Tabs (Image 2)
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
                    <th className="py-2.5 px-3">Links Preview</th>
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
                        {row["Linker Name"] || "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {row["Writer Name"] || "Unassigned"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {row["Affiliate Network"] || "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                          {row["Article Status"] || "PENDING"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                          {row["Link Status"] || "REQUESTED"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                        <div className="flex items-center gap-2">
                          {row["Article Link"] && (
                            <span title={`Article: ${row["Article Link"]}`} className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                              <FileText className="w-3 h-3" />
                              <span>Article</span>
                            </span>
                          )}
                          {row["Bridge Page Link"] && (
                            <span title={`Bridge: ${row["Bridge Page Link"]}`} className="text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                              <Link2 className="w-3 h-3" />
                              <span>Bridge</span>
                            </span>
                          )}
                          {row["Affiliate Link"] && (
                            <span title={`Affiliate: ${row["Affiliate Link"]}`} className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <ExternalLink className="w-3 h-3" />
                              <span>Affiliate</span>
                            </span>
                          )}
                        </div>
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs pt-1">
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
                    <span className="text-slate-400 text-[10px] font-bold uppercase block">New Users Created</span>
                    <span className="text-base font-black text-amber-600 dark:text-amber-400">
                      {importResult.stats.createdUsers}
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

