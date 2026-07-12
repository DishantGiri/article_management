"use client";

import { useState } from "react";
import { X, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "react-hot-toast";

interface ImportProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((val) => val.replace(/^"|"$/g, "").replace(/""/g, '"'));
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      // normalize column header names
      let key = header;
      if (header === "product name" || header === "product" || header === "title") key = "name";
      if (header === "site name" || header === "site url") key = "siteName";
      if (header === "category name") key = "categoryName";
      if (header === "trend link" || header === "trend") key = "trendLink";
      if (header === "preview link" || header === "preview") key = "previewLink";
      if (header === "remark" || header === "description") key = "remarks";

      obj[key] = (values[index] || "").trim();
    });
    results.push(obj);
  }
  return results;
}

export default function ImportProductModal({ isOpen, onClose, onSuccess, userId }: ImportProductModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ success: boolean; importedCount: number; errors: string[] } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Please upload a valid .csv file.");
      return;
    }

    setFile(selectedFile);
    setResults(null);

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
        errors: resData.errors || [],
      });

      toast.success(`Imported ${resData.importedCount} products successfully!`);
      if (resData.importedCount > 0) {
        onSuccess();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to import CSV");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ["Name", "SiteName", "CategoryName", "TrendLink", "PreviewLink", "Remarks"];
    const sample = [
      ["Super Strength Protein", "NutraVital", "Protein", "https://trends.google.com", "https://amazon.com/protein", "Best seller in sports nutrition"],
      ["Ultimate MultiVitamins", "NutraVital", "Vitamins", "", "https://amazon.com/vitamins", "High margin product"],
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
            Import Products from CSV
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
              <p className="text-sm font-semibold text-slate-700">Drag & drop your CSV file here, or click to upload</p>
              <p className="text-xs text-slate-400 mt-1">Accepts .csv files (max 10MB)</p>
              
              <input
                type="file"
                accept=".csv"
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
                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-bold text-slate-500">Name</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Site</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Category</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Trend</th>
                          <th className="px-3 py-2 font-bold text-slate-500">Preview</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {parsedData.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-semibold text-slate-700">{row.name || "--"}</td>
                            <td className="px-3 py-2 text-slate-500">{row.siteName || "--"}</td>
                            <td className="px-3 py-2 text-slate-500">{row.categoryName || "--"}</td>
                            <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{row.trendLink || "--"}</td>
                            <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{row.previewLink || "--"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 10 && (
                    <p className="text-[10px] text-slate-400 italic mt-1.5 text-right">Showing first 10 rows</p>
                  )}
                </div>
              )}
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl flex items-start gap-3 bg-slate-50 border border-slate-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">CSV Import Completed</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Successfully imported <span className="font-bold text-slate-700">{results.importedCount}</span> products out of {parsedData.length} records.
                  </p>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Failed Rows / Warnings ({results.errors.length})
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
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
          >
            {results ? "Close" : "Cancel"}
          </button>
          {!results && file && (
            <button
              onClick={handleImport}
              disabled={loading || parsedData.length === 0}
              className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              {loading ? "Importing..." : "Start Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
