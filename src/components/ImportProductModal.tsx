/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, Info, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { cleanUrl, extractGeoLinksFromRow, isNullOrPlaceholder } from "@/lib/geo-link-parser";
import { extractThreeDatesFromRow, formatNoonUtcYmd, isDateColumnKey } from "@/lib/sheet-dates";

interface ImportProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: number;
}

function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  if (tabs > commas && tabs > semicolons) return "\t";
  if (semicolons > commas && semicolons > tabs) return ";";
  return ",";
}

function parseCSVLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((val) => val.replace(/^"|"$/g, "").trim());
}

const KNOWN_SITE_CODES = ["dhs", "smg", "tbr", "grc", "sc", "sv", "sd", "st", "sp", "jir", "rbr", "hsb", "hse", "bhfr", "hsblog", "hpr"];

function isPositive(val: string): boolean {
  const s = val.trim().toLowerCase();
  if (!s) return false;
  if (cleanUrl(val)) return false;
  return !["0", "false", "no", "n", "-", "--", "none", "nil", "null", "na", "n/a"].includes(s);
}

function normalizeParsedRowObject(rawEntries: Array<[string, any]>): Record<string, any> | null {
  const obj: Record<string, any> = {};
  const selectedSites: string[] = [];

  for (const [rawKey, rawVal] of rawEntries) {
    const val = rawVal === undefined || rawVal === null ? "" : String(rawVal).trim();
    const cleanRawHeader = String(rawKey || "").trim();
    if (!cleanRawHeader) continue;
    const h = cleanRawHeader.toLowerCase().replace(/[\s_-]+/g, "");

    obj[cleanRawHeader] = val;
    if (!(h in obj)) {
      obj[h] = val;
    }

    if (h === "name" || h === "productname" || h === "product" || h === "title") {
      obj.name = val;
    } else if (h === "slug") {
      obj.slug = val;
    } else if (h === "country" || h === "geo") {
      obj.country = val;
    } else if (h === "category" || h === "categoryname" || h === "producttype" || h === "type") {
      obj.categoryName = val;
    } else if (h === "productcategory" || h === "productcategoryname") {
      obj.productCategory = val;
    } else if (h === "source" || h === "productsource") {
      obj.source = val;
    } else if (h === "trend" || h === "trendlevel") {
      if (/^https?:\/\//i.test(val)) {
        obj.trendLink = val;
      } else if (!isNullOrPlaceholder(val)) {
        obj.trendLevel = val.toUpperCase();
      }
    } else if (h === "trendlink") {
      obj.trendLink = val;
    } else if (h === "productavailability" || h === "availability") {
      obj.productAvailability = val;
    } else if (h === "affiliatenetwork" || h === "affiliate" || h === "network") {
      obj.affiliateName = val;
    } else if (
      h === "researchedby" ||
      h === "researcher" ||
      h === "addedby" ||
      h === "addedbyname" ||
      h === "added_by" ||
      h === "user" ||
      h === "author" ||
      h === "creator"
    ) {
      obj.researchedBy = val;
    } else if (h === "date" || h === "addedat") {
      obj.date = val;
    } else if (h === "previewlink" || h === "preview" || h === "previewurl") {
      obj.previewLink = val;
    } else if (h === "remarks" || h === "remark" || h === "description" || h === "notes") {
      obj.remarks = val;
    } else if (h === "site" || h === "sitename" || h === "website") {
      obj.siteName = val;
    }

    if (KNOWN_SITE_CODES.includes(h) && isPositive(val)) {
      selectedSites.push(cleanRawHeader);
    }
  }

  if (selectedSites.length > 0) {
    obj.selectedSites = selectedSites;
  }

  if (!obj.name || isNullOrPlaceholder(obj.name)) {
    return null;
  }
  return obj;
}

function parseCSV(text: string): Record<string, any>[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseCSVLine(lines[0], delimiter);
  const results: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const entries = rawHeaders.map((rawHeader, index): [string, any] => [rawHeader, values[index] || ""]);
    const normalized = normalizeParsedRowObject(entries);
    if (normalized) {
      results.push(normalized);
    }
  }
  return results;
}

export default function ImportProductModal({ isOpen, onClose, onSuccess, userId }: ImportProductModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    importedCount: number;
    importedLinksCount?: number;
    importedGeosCount?: number;
    skippedCount?: number;
    skipped?: string[];
    errors: string[];
  } | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const lowerName = selectedFile.name.toLowerCase();
    const isExcel = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");
    const isCsv = lowerName.endsWith(".csv") || lowerName.endsWith(".tsv") || lowerName.endsWith(".txt");

    if (!isExcel && !isCsv) {
      toast.error("Please upload a valid .xlsx, .xls, .csv, or .tsv file.");
      return;
    }

    setFile(selectedFile);
    setResults(null);

    if (isExcel) {
      try {
        const [XLSX, buffer] = await Promise.all([import("xlsx"), selectedFile.arrayBuffer()]);
        const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
        const rows: Record<string, any>[] = [];

        for (const sheetName of workbook.SheetNames) {
          const cleanSheet = sheetName.trim().toLowerCase();
          if (["readme", "instructions", "guide", "summary"].includes(cleanSheet)) continue;

          const sheet = workbook.Sheets[sheetName];
          const sheetRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

          for (const rawRow of sheetRows) {
            const entries: Array<[string, any]> = Object.keys(rawRow).map((k) => {
              let val = rawRow[k];
              if (isDateColumnKey(k) && typeof val === "number" && Number.isFinite(val)) {
                const dc = XLSX.SSF.parse_date_code(val);
                if (dc && dc.y >= 1900) {
                  val = `${dc.y}-${String(dc.m).padStart(2, "0")}-${String(dc.d).padStart(2, "0")}`;
                }
              }
              return [k, val];
            });

            const normalized = normalizeParsedRowObject(entries);
            if (!normalized) continue;

            // Default siteName from tab name if workbook uses per-site tabs and row lacks siteName/checkmarks
            if (
              !normalized.siteName &&
              (!normalized.selectedSites || normalized.selectedSites.length === 0) &&
              !/^(sheet\d*|data|products|export|merged)$/i.test(cleanSheet)
            ) {
              normalized.siteName = sheetName.trim();
            }

            rows.push(normalized);
          }
        }
        setParsedData(rows);
      } catch (err: any) {
        toast.error(err?.message || "Failed to read Excel file.");
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      setParsedData(data);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error("No valid products found in the file.");
      return;
    }

    const shortNames = parsedData.filter((r) => !r.name || r.name.trim().length < 2);
    if (shortNames.length > 0) {
      toast.error(`Found ${shortNames.length} product(s) with missing or short names. Minimum 2 characters required.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: parsedData,
          addedById: userId,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to import products");

      setResults({
        success: resData.success,
        importedCount: resData.importedCount,
        importedLinksCount: resData.importedLinksCount || 0,
        importedGeosCount: resData.importedGeosCount || 0,
        skippedCount: resData.skippedCount || 0,
        skipped: resData.skipped || [],
        errors: resData.errors || [],
      });

      if (resData.importedCount > 0) {
        toast.success(`Imported ${resData.importedCount} new products successfully!${resData.skippedCount ? ` (${resData.skippedCount} duplicates skipped)` : ""}`);
        onSuccess?.();
      } else if (resData.skippedCount > 0) {
        toast.success(`Done: ${resData.skippedCount} products already exist in catalog (duplicates skipped).`);
        onSuccess?.();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to import file");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "Product Name",
      "Type",
      "Source",
      "Trend",
      "Product Availability",
      "Affiliate Network",
      "Researched By",
      "Date",
      "DHS",
      "SMG",
      "TBR",
      "GRC",
      "SC",
      "SV",
      "SD",
      "ST",
      "SP",
      "JiR",
      "RBR",
      "HSB",
      "HSE",
    ];
    const sample = [
      [
        "Super Strength Protein",
        "Supplements",
        "Affiliate",
        "HIGH",
        "Available",
        "BuyGoods",
        "Muna",
        "2026-11-01",
        "x",
        "x",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [
        "Ultimate MultiVitamins",
        "Supplements",
        "Competitor",
        "MODERATE",
        "Available",
        "ClickBank",
        "Rahul Gupta",
        "2026-11-02",
        "x",
        "",
        "x",
        "x",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ];
    const csvContent = [
      headers.join(","),
      ...sample.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "products_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
            Import Products from CSV / Excel
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {!file && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-10 bg-slate-50/50 hover:bg-slate-50 transition-colors group relative">
              <Upload className="w-12 h-12 text-slate-400 group-hover:text-indigo-500 transition-colors mb-4" />
              <p className="text-sm font-semibold text-slate-700">Drag & drop your Excel or CSV file here, or click to upload</p>
              <p className="text-xs text-slate-400 mt-1">Accepts .xlsx, .xls, .csv, or .tsv files (supports multi-GEO columns like US Link, UK Link)</p>
              
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <button
                onClick={downloadTemplate}
                className="mt-6 text-xs text-indigo-600 hover:text-indigo-700 font-bold hover:underline"
              >
                Download CSV Import Template
              </button>
            </div>
          )}

          {file && !results && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{file.name}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  onClick={() => { setFile(null); setParsedData([]); }}
                  className="text-xs text-rose-500 hover:text-rose-600 font-bold hover:underline"
                >
                  Change File
                </button>
              </div>

              {parsedData.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Parsed Preview ({parsedData.length} entries)</h3>
                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-bold text-slate-500">Name</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Type</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Source</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Trend</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Affiliate</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Added By</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Sites</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Dates</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Links &amp; GEOs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {parsedData.slice(0, 15).map((row, idx) => {
                          const sitesDisplay = row.selectedSites && row.selectedSites.length > 0
                            ? row.selectedSites.join(", ")
                            : (row.siteName && !isNullOrPlaceholder(row.siteName) ? row.siteName : "All Sites");

                          const affiliateDisplay =
                            row.affiliateName && !isNullOrPlaceholder(row.affiliateName) && row.affiliateName.toLowerCase().trim() !== "general"
                              ? row.affiliateName
                              : "No Affiliate";

                          const addedByDisplay = row.researchedBy || row["Researched By"] || row["Added By"] || row.addedBy || "(Current User)";
                          const { geoLinks } = extractGeoLinksFromRow(row, affiliateDisplay);
                          const hasAff = Boolean(cleanUrl(row["Affiliate Link"] || row.affiliatelink || row["Affiliate URL"]));
                          const hasBuy = Boolean(cleanUrl(row["Buy Link"] || row["Buy Now Link"] || row.buylink || row.buynowlink));
                          const hasBridge = Boolean(cleanUrl(row["Bridge Page Link"] || row["Bridge Link"] || row.bridgepagelink));

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-semibold text-slate-700">{row.name || "--"}</td>
                              <td className="px-3 py-2 text-slate-500">{!isNullOrPlaceholder(row.categoryName) ? row.categoryName : (!isNullOrPlaceholder(row.type) ? row.type : "--")}</td>
                              <td className="px-3 py-2 text-slate-500">{!isNullOrPlaceholder(row.source) ? row.source : "--"}</td>
                              <td className="px-3 py-2 text-slate-500">{!isNullOrPlaceholder(row.trendLevel) ? row.trendLevel : "--"}</td>
                              <td className="px-3 py-2 text-slate-500">{affiliateDisplay}</td>
                              <td className="px-3 py-2 text-slate-600 font-medium">{addedByDisplay}</td>
                              <td className="px-3 py-2 text-indigo-600 font-semibold">{sitesDisplay}</td>
                              <td className="px-3 py-2 text-[10px] font-mono whitespace-nowrap">
                                {(() => {
                                  const d = extractThreeDatesFromRow(row);
                                  const addStr = formatNoonUtcYmd(d.addedDate);
                                  const writeStr = formatNoonUtcYmd(d.writeDate);
                                  const pubStr = formatNoonUtcYmd(d.publishDate);
                                  if (!addStr && !writeStr && !pubStr) {
                                    return <span className="text-slate-300">—</span>;
                                  }
                                  return (
                                    <div className="flex flex-col gap-0.5">
                                      {addStr && <span className="text-slate-600">Add: {addStr}</span>}
                                      {writeStr && <span className="text-indigo-600">Wrt: {writeStr}</span>}
                                      {pubStr && <span className="text-emerald-600">Pub: {pubStr}</span>}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-2">
                                {geoLinks.length > 0 || hasAff || hasBuy || hasBridge ? (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    {hasBuy && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">Buy</span>}
                                    {hasBridge && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">Bridge</span>}
                                    {hasAff && geoLinks.length === 0 && <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">Aff</span>}
                                    {geoLinks.map((g) => (
                                      <span
                                        key={g.geo}
                                        title={`${g.geo}: ${g.affiliateLink}`}
                                        className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold"
                                      >
                                        {g.geo}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 15 && (
                    <p className="text-[10px] text-slate-400 italic mt-1.5 text-right">Showing first 15 rows</p>
                  )}
                </div>
              )}
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl flex items-start gap-3 ${
                  results.importedCount > 0
                    ? "bg-emerald-50/70 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/40"
                    : results.skippedCount && results.skippedCount > 0 && results.errors.length === 0
                    ? "bg-amber-50/70 border border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/40"
                    : "bg-rose-50/70 border border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/40"
                }`}
              >
                {results.importedCount > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : results.skippedCount && results.skippedCount > 0 && results.errors.length === 0 ? (
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3
                    className={`text-sm font-bold ${
                      results.importedCount > 0
                        ? "text-emerald-950 dark:text-emerald-200"
                        : results.skippedCount && results.skippedCount > 0 && results.errors.length === 0
                        ? "text-amber-950 dark:text-amber-200"
                        : "text-rose-950 dark:text-rose-200"
                    }`}
                  >
                    {results.importedCount > 0
                      ? "Import Completed"
                      : results.skippedCount && results.skippedCount > 0 && results.errors.length === 0
                      ? "Import Finished (All Existing)"
                      : "Import Incomplete"}
                  </h3>
                  <p
                    className={`text-xs mt-0.5 ${
                      results.importedCount > 0
                        ? "text-emerald-800 dark:text-emerald-300"
                        : results.skippedCount && results.skippedCount > 0 && results.errors.length === 0
                        ? "text-amber-800 dark:text-amber-300"
                        : "text-rose-800 dark:text-rose-300"
                    }`}
                  >
                    Successfully imported <span className="font-bold">{results.importedCount}</span> new product{results.importedCount !== 1 ? "s" : ""}.
                    {Boolean(results.importedLinksCount && results.importedLinksCount > 0) && (
                      <span className="ml-1 font-semibold text-indigo-700 dark:text-indigo-400">
                        ({results.importedLinksCount} link config{results.importedLinksCount !== 1 ? "s" : ""}, {results.importedGeosCount || 0} geo link{(results.importedGeosCount || 0) !== 1 ? "s" : ""})
                      </span>
                    )}
                    {Boolean(results.skippedCount && results.skippedCount > 0) && (
                      <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400">
                        ({results.skippedCount} existing duplicate{results.skippedCount !== 1 ? "s" : ""} skipped)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {results.skipped && results.skipped.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-500" />
                    Skipped Existing Products ({results.skipped.length})
                  </h4>
                  <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-3 max-h-[140px] overflow-y-auto">
                    <ul className="list-disc pl-4 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                      {results.skipped.map((msg: string, idx: number) => (
                        <li key={idx}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Failed Rows ({results.errors.length})
                  </h4>
                  <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 max-h-[200px] overflow-y-auto">
                    <ul className="list-disc pl-4 text-xs text-rose-600 space-y-1">
                      {results.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
          {results ? (
            <>
              <button
                onClick={() => {
                  setFile(null);
                  setParsedData([]);
                  setResults(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                Upload Another
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Cancel
              </button>
              {file && (
                <button
                  onClick={handleImport}
                  disabled={loading || parsedData.length === 0}
                  className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    "Start Import"
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
