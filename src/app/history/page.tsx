"use client";

import { useState, useEffect, useMemo } from "react";
import CustomSelect from "@/components/CustomSelect";
import { Search, Clock, ArrowRight, FileText, Link2 } from "lucide-react";
import { useSession } from "next-auth/react";

interface HistoryRecord {
  id: string;
  type: "ARTICLE" | "LINK";
  updatedById: number;
  productName: string;
  siteName: string;
  oldStatus: string | null;
  newStatus: string | null;
  oldLink: string | null;
  newLink: string | null;
  notes: string | null;
  updatedAt: string;
  updatedBy: {
    id: number;
    name: string;
    role: string;
    email: string;
  };
}

export default function HistoryPage() {
  const { data: session } = useSession();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "ARTICLE" | "LINK">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    if (!session?.user?.id) return;

    setLoading(true);
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        setHistory(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  const filtered = history.filter((record) => {
    // Type Filter
    if (typeFilter && record.type !== typeFilter) return false;

    // Search Filter
    const userName = record.updatedBy?.name || "";
    const pName = record.productName || "";
    const sName = record.siteName || "";
    const nts = record.notes || "";

    const matchSearch =
      userName.toLowerCase().includes(search.toLowerCase()) ||
      pName.toLowerCase().includes(search.toLowerCase()) ||
      sName.toLowerCase().includes(search.toLowerCase()) ||
      nts.toLowerCase().includes(search.toLowerCase());

    // Date Filter
    let matchDate = true;
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const d = new Date(record.updatedAt);
      if (d < s) matchDate = false;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      const d = new Date(record.updatedAt);
      if (d > e) matchDate = false;
    }

    return matchSearch && matchDate;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageSize = 5;
    const currentBlock = Math.floor((currentPage - 1) / pageSize);
    const start = currentBlock * pageSize + 1;
    const end = Math.min(totalPages, start + pageSize - 1);

    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 py-3 px-4 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400">
          Showing{" "}
          {filtered.length === 0
            ? 0
            : (currentPage - 1) * itemsPerPage + 1}
          -
          {Math.min(currentPage * itemsPerPage, filtered.length)} of{" "}
          {filtered.length}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2.5 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="First Page"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="Previous Page"
          >
            &lt;
          </button>

          {start > 1 && (
            <button
              onClick={() => setCurrentPage(start - 1)}
              className="text-xs font-bold text-slate-400 hover:text-indigo-600 px-1 cursor-pointer"
              title="Previous 5 Pages"
            >
              ...
            </button>
          )}

          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition cursor-pointer ${
                currentPage === p
                  ? "bg-indigo-600 text-white border border-indigo-600 shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}

          {end < totalPages && (
            <button
              onClick={() => setCurrentPage(end + 1)}
              className="text-xs font-bold text-slate-400 hover:text-indigo-600 px-1 cursor-pointer"
              title="Next 5 Pages"
            >
              ...
            </button>
          )}

          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
            disabled={currentPage === totalPages || totalPages === 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="Next Page"
          >
            &gt;
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-2.5 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="Last Page"
          >
            Last
          </button>
        </div>
      </div>
    );
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A] tracking-tight">System Activity Log</h1>
          <p className="text-[#737373] text-sm mt-0.5 font-medium">
            Full history of additions, modifications, status updates, and link logs
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search users, products, sites or notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white placeholder-slate-400 text-slate-800 transition"
          />
        </div>

        {/* Type Filter */}
        <CustomSelect
          value={typeFilter}
          onChange={(val) => {
            setTypeFilter(val as any);
            setCurrentPage(1);
          }}
          placeholder="All Activity Types"
          className="min-w-[145px]"
          options={[
            { value: "", label: "All Activity Types" },
            { value: "ARTICLE", label: "Article Changes" },
            { value: "LINK", label: "Link Log Changes" },
          ]}
        />

        {/* Date Filters */}
        <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-20 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-semibold text-sm">No activity records found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 w-[12%]">Type</th>
                  <th className="px-4 py-3 w-[15%]">Date & Time</th>
                  <th className="px-4 py-3 w-[18%]">Modified By</th>
                  <th className="px-4 py-3 w-[20%]">Product / Site</th>
                  <th className="px-4 py-3 w-[35%]">Modification Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {paginated.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                    {/* Activity Type Badge */}
                    <td className="px-4 py-4 align-top">
                      {record.type === "ARTICLE" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <FileText className="w-3 h-3 text-indigo-500" /> Article
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <Link2 className="w-3 h-3 text-emerald-500" /> Link Log
                        </span>
                      )}
                    </td>

                    {/* Date & Time */}
                    <td className="px-4 py-4 align-top">
                      <p className="font-bold text-slate-800">
                        {new Date(record.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {new Date(record.updatedAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </td>

                    {/* Modified By User */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {getInitials(record.updatedBy?.name)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">
                            {record.updatedBy?.name || "System"}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide">
                            {record.updatedBy?.role ? record.updatedBy.role.replace("_", " ") : "USER"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Product & Site */}
                    <td className="px-4 py-4 align-top">
                      <p className="font-bold text-indigo-600 text-xs">{record.productName}</p>
                      <span className="inline-block px-2 py-0.5 mt-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                        {record.siteName}
                      </span>
                    </td>

                    {/* Modification Details */}
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1.5">
                        {record.oldStatus && record.newStatus && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="text-slate-400 font-medium">Status:</span>
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold uppercase text-slate-600">
                              {record.oldStatus}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold uppercase">
                              {record.newStatus}
                            </span>
                          </div>
                        )}
                        {record.notes && (
                          <div className="text-xs text-slate-700 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100/60">
                            <span className="font-bold text-amber-800 block mb-0.5">Details / Remarks:</span>
                            {record.notes}
                          </div>
                        )}
                        {record.oldLink !== record.newLink && record.newLink && (
                          <div className="text-xs text-slate-700 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/60 break-all font-mono">
                            <span className="font-bold text-blue-800 font-sans block mb-0.5">Link Updated:</span>
                            {record.newLink}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        )}
      </div>
    </div>
  );
}
