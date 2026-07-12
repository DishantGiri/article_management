/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { Search, Clock, SlidersHorizontal, ArrowRight } from "lucide-react";
import { useSession } from "next-auth/react";

interface HistoryRecord {
  id: number;
  articleId: number;
  updatedById: number;
  oldStatus: string | null;
  newStatus: string | null;
  oldLink: string | null;
  newLink: string | null;
  notes: string | null;
  updatedAt: string;
  updatedBy: {
    name: string;
    role: string;
  };
  article: {
    product: {
      name: string;
      site: { name: string };
    };
  };
}

export default function HistoryPage() {
  const { data: session } = useSession();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
    // Search
    const matchSearch =
      record.updatedBy.name.toLowerCase().includes(search.toLowerCase()) ||
      record.article.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (record.notes && record.notes.toLowerCase().includes(search.toLowerCase()));

    // Date
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
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    const pages = [];
    for (let i = 1; i <= Math.min(5, totalPages); i++) pages.push(i);
    return (
      <div className="flex items-center justify-between mt-4 py-3 px-2 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400">
          Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            &lt;
          </button>
          {pages.map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition ${
                currentPage === p 
                  ? "bg-indigo-500 text-white border border-indigo-500 shadow-sm" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            &gt;
          </button>
        </div>
      </div>
    );
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Activity Log</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">Track all system changes and updates</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 min-w-[250px] max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search users or products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder-slate-400 font-medium text-slate-700 transition"
          />
        </div>

        <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-20 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium text-sm">No activity records found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[15%]">Date & Time</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[20%]">User</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[25%]">Product</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[40%]">Activity details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-4 align-top">
                      <p className="text-[13px] font-semibold text-slate-700">
                        {new Date(record.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                        {new Date(record.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                          {getInitials(record.updatedBy.name)}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800 leading-none">{record.updatedBy.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{record.updatedBy.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-[13px] font-semibold text-indigo-600">{record.article.product.name}</p>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">{record.article.product.site.name}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1.5">
                        {record.oldStatus && record.newStatus && (
                          <div className="flex items-center gap-2 text-[12px] font-medium text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-400">Status changed:</span>
                            <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase">{record.oldStatus}</span>
                            <ArrowRight className="w-3 h-3 text-slate-300" />
                            <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[10px] font-bold uppercase">{record.newStatus}</span>
                          </div>
                        )}
                        {record.notes && (
                          <div className="text-[12px] text-slate-600 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50">
                            <span className="font-bold text-amber-700 block mb-0.5">Notes attached:</span>
                            {record.notes}
                          </div>
                        )}
                        {record.oldLink !== record.newLink && record.newLink && (
                          <div className="text-[12px] text-slate-600 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 break-all">
                            <span className="font-bold text-blue-700 block mb-0.5">Article Link Updated:</span>
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
