"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Upload, Download, SlidersHorizontal, ExternalLink, MoreHorizontal } from "lucide-react";
import AddProductModal from "@/components/AddProductModal";

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  trendLink?: string;
  previewLink?: string;
  remarks?: string;
  addedAt: string;
  site: { name: string };
  category: { id: number, name: string };
  addedBy: { name: string };
  article?: { id: number; status: string, writer?: { name: string } };
  linkLogs?: any[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  REVIEW: "bg-cyan-100 text-cyan-700",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    const mockUserId = typeof window !== "undefined" ? localStorage.getItem("mockUserId") || "1" : "1";
    Promise.all([
      fetch(`/api/products?userId=${mockUserId}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ])
      .then(([productsData, categoriesData]) => {
        // Mock links array for UI demonstration since links might not be fully fetched
        const mapped = productsData.map((p: any) => ({
          ...p,
          mockLinksCount: Math.floor(Math.random() * 8) + 1
        }));
        setProducts(mapped);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.site.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || p.category?.id?.toString() === categoryFilter;
    const matchStatus = !statusFilter || (p.article ? p.article.status === statusFilter : false);
    return matchSearch && matchCategory && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    const pages = [];
    for (let i = 1; i <= Math.min(5, totalPages); i++) pages.push(i);
    return (
      <div className="flex items-center justify-between mt-4 py-3 px-2 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400">
          Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
          >
            &lt;
          </button>
          {pages.map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold ${
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
            className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Products</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">{filtered.length} products found</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-600 shadow-sm transition flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Product
          </button>
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2">
            <Upload className="w-4 h-4 text-slate-500" />
            Import
          </button>
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2">
            <Download className="w-4 h-4 text-slate-500" />
            Export
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder-slate-400 font-medium text-slate-700"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none min-w-32 cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
          <option value="REVIEW">Review</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none min-w-32 cursor-pointer max-w-xs truncate"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          Filters
        </button>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-500 font-medium">No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Name</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Site</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trend</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Added By</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Writer</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Links</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((p: any) => {
                  const status = p.article?.status || "PENDING";
                  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-semibold text-slate-800">{p.name}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-medium text-slate-600">{p.site?.name}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-medium text-slate-600">{p.category?.name}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        {p.trendLink ? (
                          <a href={p.trendLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-500 hover:text-blue-600 transition">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Link
                          </a>
                        ) : (
                          <span className="text-[12px] font-semibold text-slate-300">--</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-medium text-slate-600">{p.addedBy?.name}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[12px] font-medium text-slate-500">
                          {new Date(p.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        {p.article?.writer?.name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold">
                              {getInitials(p.article.writer.name)}
                            </div>
                            <span className="text-[12px] font-semibold text-slate-600">{p.article.writer.name}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] font-medium text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${statusColor}`}>
                          {status === "IN_PROGRESS" ? "In Progress" : status.charAt(0) + status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="text-[13px] font-semibold text-slate-600">{p.mockLinksCount || 0}</span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <button className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 mx-auto transition">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        )}
      </div>

      <AddProductModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => {
          // Trigger a re-fetch of products if needed, or simply let the user close it
          window.location.reload();
        }}
      />
    </div>
  );
}
