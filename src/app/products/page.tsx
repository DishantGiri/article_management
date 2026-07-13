"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Upload, Download, SlidersHorizontal, ExternalLink, FileText, LayoutGrid, Globe, PlayCircle, X, Copy, Clock, Calendar, Package, Edit, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import AddProductModal from "@/components/AddProductModal";
import EditProductModal from "@/components/EditProductModal";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  siteId: number;
  categoryId: number;
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
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState("WRITER");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const itemsPerPage = 10;
  const router = useRouter();

  const handleDeleteProduct = async (productId: number, productName: string) => {
    if (confirm(`Are you sure you want to delete "${productName}"? This will also delete all associated article tracking and link log entries.`)) {
      const uId = session?.user?.id || 1;
      try {
        const res = await fetch(`/api/products/${productId}?callerId=${uId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to delete product");
        }
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        toast.success("Product deleted successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete product");
      }
    }
  };

  const [userFilter, setUserFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    const mockUserId = session.user.id;
    const uRole = session.user.role || "WRITER";
    setCurrentUserRole(uRole);

    setLoading(true);
    Promise.all([
      fetch(`/api/products?userId=${mockUserId}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch(`/api/dashboard?userId=${mockUserId}`).then((r) => r.json()),
    ])
      .then(([productsData, categoriesData, dashboardData]) => {
        const mapped = productsData.map((p: any) => ({
          ...p,
          mockLinksCount: Math.floor(Math.random() * 8) + 1
        }));
        setProducts(mapped);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setStats(dashboardData);
      })
      .finally(() => setLoading(false));

    // Live status updates via WebSocket
    let ws: WebSocket | null = null;
    try {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.host;
      ws = new WebSocket(`${wsProtocol}//${wsHost}/ws`);
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: "register", userId: mockUserId }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ARTICLE_STATUS_UPDATED" && msg.data) {
            const updated = msg.data;
            setProducts((prev) =>
              prev.map((p) =>
                p.id === updated.productId
                  ? {
                      ...p,
                      article: {
                        id: updated.id,
                        status: updated.status,
                        writer: updated.writer,
                      },
                    }
                  : p
              )
            );
            // Also patch selectedProduct if it's open
            setSelectedProduct((prev) =>
              prev && prev.id === updated.productId
                ? {
                    ...prev,
                    article: {
                      id: updated.id,
                      status: updated.status,
                      writer: updated.writer,
                    },
                  }
                : prev
            );
          }
        } catch (e) {}
      };
      ws.onerror = () => {};
    } catch (e) {}

    return () => {
      ws?.close();
    };
  }, [session?.user?.id]);

  const uniqueAdders = Array.from(new Set(products.map((p) => p.addedBy?.name).filter(Boolean))) as string[];

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.site.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || p.category?.id?.toString() === categoryFilter;
    const matchStatus = !statusFilter || (p.article ? p.article.status === statusFilter : false);

    // Added By filter
    const matchUser = !userFilter || p.addedBy?.name === userFilter;

    // Date Range filter
    let matchDate = true;
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const d = new Date(p.addedAt);
      if (d < s) matchDate = false;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      const d = new Date(p.addedAt);
      if (d > e) matchDate = false;
    }

    return matchSearch && matchCategory && matchStatus && matchUser && matchDate;
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
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]" suppressHydrationWarning>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Products</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">{filtered.length} products found</p>
        </div>
        <div className="flex items-center gap-3">
          {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "LINKER") && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-600 shadow-sm transition flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
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

      {/* Metric Cards Row */}
      {stats && (currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD" || currentUserRole === "LINKER") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center text-violet-500 mb-2"><Package className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general.totalProducts || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Products</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2"><Clock className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general.pendingArticles || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Pending Products</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2"><Calendar className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general.todaysProducts || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Today's Products</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-500 mb-2"><Globe className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general.totalSites || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Sites</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-500 mb-2"><LayoutGrid className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general.totalCategories || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Categories</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder-slate-400 font-medium text-slate-700"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[120px]"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
          <option value="REVIEW">Review</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[140px] max-w-xs truncate"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Added By User Filter */}
        <select
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[130px]"
        >
          <option value="">All Adders</option>
          {uniqueAdders.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Date Range Start */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Date Range End */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

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
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Added By</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD") && (
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  )}
                  <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Links</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((p: any) => {
                  const status = p.article?.status || "PENDING";
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-semibold text-slate-800">{p.name}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        {p.site?.url ? (
                          <a 
                            href={p.site.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-1"
                          >
                            {p.site.name}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-[13px] font-medium text-slate-600">{p.site?.name}</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-medium text-slate-600">{p.category?.name}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-medium text-slate-600">{p.addedBy?.name}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[12px] font-medium text-slate-500">
                          {new Date(p.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD") && (
                        <td className="px-3 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${STATUS_COLORS[status] || STATUS_COLORS.PENDING}`}>
                            {status === "IN_PROGRESS" ? "In Progress" : status.charAt(0) + status.slice(1).toLowerCase()}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-3.5 text-center">
                        <span className="text-[13px] font-semibold text-slate-600">{p.linkLogs?.length || 0}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {/* Review — for Admin/Team Lead, link to article; for others, show product modal */}
                          {p.article && (currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD") ? (
                            <Link
                              href={`/articles/${p.article.id}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-[11px] font-semibold whitespace-nowrap"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Review
                            </Link>
                          ) : (
                            <button
                              onClick={() => setSelectedProduct(p)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Preview
                            </button>
                          )}

                          {/* WRITER & TEAM_LEAD: Write button — always shown, disabled unless PENDING */}
                          {(currentUserRole === "WRITER" || currentUserRole === "TEAM_LEAD") && (
                            <button
                              disabled={status !== "PENDING"}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!p.article || status !== "PENDING") return;
                                try {
                                  const uId = session?.user?.id || 1;
                                  const res = await fetch(`/api/articles/${p.article.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: "IN_PROGRESS", writerId: uId, callerId: uId }),
                                  });
                                  if (res.ok) {
                                    toast.success("Started writing!");
                                    setTimeout(() => window.location.reload(), 1000);
                                  } else {
                                    const err = await res.json();
                                    toast.error(err.error || "Failed to start writing");
                                  }
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to start writing");
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
                                status === "PENDING"
                                  ? "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              }`}
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              Write
                            </button>
                          )}

                          {/* LINKER/ADMIN: Edit & Delete buttons */}
                          {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "LINKER") && (
                            <>
                              <button
                                onClick={() => setEditingProduct(p)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition-all text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-all text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
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

      <EditProductModal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        onSuccess={() => {
          window.location.reload();
        }}
        product={editingProduct}
      />

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Assignment Details</h2>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{selectedProduct.name}</h3>
                <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> {selectedProduct.site.name}</span>
                  <span className="flex items-center gap-1.5"><LayoutGrid className="w-4 h-4" /> {selectedProduct.category.name}</span>
                </div>
              </div>

              {(selectedProduct.trendLink || selectedProduct.previewLink) && (
                <div className="flex gap-3">
                  {selectedProduct.trendLink && (
                    <a href={selectedProduct.trendLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition">
                      <ExternalLink className="w-4 h-4" /> Trend Link
                    </a>
                  )}
                  {selectedProduct.previewLink && (
                    <a href={selectedProduct.previewLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold transition">
                      <Globe className="w-4 h-4" /> Preview Link
                    </a>
                  )}
                </div>
              )}

              {selectedProduct.remarks && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm text-amber-800">
                  <span className="font-bold block mb-1">Remarks:</span>
                  {selectedProduct.remarks}
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-3">Links & Geos</h4>
                {selectedProduct.linkLogs && selectedProduct.linkLogs.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedProduct.linkLogs.map((log: any) => (
                      <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-slate-800 text-xs">{log.affiliateName}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{log.status}</span>
                        </div>
                        <div className="space-y-1 mb-2">
                          {log.affiliateLink && (
                            <div><span className="text-[9px] font-bold text-slate-400 uppercase">Affiliate Link:</span> <a href={log.affiliateLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 hover:underline break-all block truncate">{log.affiliateLink}</a></div>
                          )}
                          {log.bridgePageLink && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
                                Bridge Page:
                                <button onClick={() => { navigator.clipboard.writeText(log.bridgePageLink); toast.success("Copied bridge page link!"); }} className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition" title="Copy Bridge Page Link"><Copy className="w-3 h-3" /></button>
                              </span> 
                              <a href={log.bridgePageLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 hover:underline break-all block truncate mt-0.5">{log.bridgePageLink}</a>
                            </div>
                          )}
                          {log.buyLink && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
                                Buy Link:
                                <button onClick={() => { navigator.clipboard.writeText(log.buyLink); toast.success("Copied buy link!"); }} className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition" title="Copy Buy Link"><Copy className="w-3 h-3" /></button>
                              </span> 
                              <a href={log.buyLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 hover:underline break-all block truncate mt-0.5">{log.buyLink}</a>
                            </div>
                          )}
                          {log.linkerRemarks && (
                            <div className="mt-1.5 bg-slate-100 p-1.5 rounded text-[10px] text-slate-600"><span className="font-bold">Remarks:</span> {log.linkerRemarks}</div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {log.geos?.map((g: any) => (
                            <span key={g.geo} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-500 uppercase">{g.geo}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No links configured yet.</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setSelectedProduct(null)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-white transition">Close</button>
              
              {(currentUserRole === "WRITER" || currentUserRole === "TEAM_LEAD") && selectedProduct.article?.status === "PENDING" && (
                <button 
                  onClick={async () => {
                    if (!selectedProduct.article) return;
                    try {
                      const uId = session?.user?.id || 1;
                      const res = await fetch(`/api/articles/${selectedProduct.article.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "IN_PROGRESS", writerId: uId, callerId: uId }),
                      });
                      if (res.ok) {
                        toast.success("Started writing!");
                        setTimeout(() => window.location.reload(), 1000);
                      } else {
                        const err = await res.json();
                        toast.error(err.error || "Failed to start writing");
                      }
                    } catch (e: any) {
                      toast.error(e.message || "Failed to start writing");
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" /> Start Writing
                </button>
              )}

              {currentUserRole !== "WRITER" && selectedProduct.article && (
                <Link 
                  href={`/articles/${selectedProduct.article.id}`}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> View Article Tracking
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
