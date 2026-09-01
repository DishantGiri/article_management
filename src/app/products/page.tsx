"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Upload, Download, SlidersHorizontal, ExternalLink, FileText, LayoutGrid, Globe, PlayCircle, X, Copy, Clock, Calendar, Package, Edit, Trash2, Flame, TrendingUp, ChevronDown, Tag, AlertTriangle, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";
import FormattedRemarks from "@/components/FormattedRemarks";
import AddProductModal from "@/components/AddProductModal";
import EditProductModal from "@/components/EditProductModal";
import ImportProductModal from "@/components/ImportProductModal";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import CustomSelect from "@/components/CustomSelect";
import DateRangePicker from "@/components/DateRangePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingScreen from "@/components/LoadingScreen";

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  siteId: number;
  categoryId: number;
  productCategory?: string | null;
  trendLink?: string;
  trendLevel?: string;
  affiliateName?: string | null;
  previewLink?: string;
  remarks?: string;
  addedAt: string;
  site: { id?: number; name: string; url?: string };
  category: { id?: number; name: string };
  addedBy: { id?: number; name: string };
  article?: { id: number; status: string; writer?: { id?: number; name: string } };
  linkLogs?: any[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200/60",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border border-blue-200/60",
  COMPLETED: "bg-indigo-50 text-indigo-700 border border-indigo-200/60",
  APPROVED: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  REDO: "bg-rose-50 text-rose-700 border border-rose-200/60",
};

export default function ProductsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<"products" | "my-articles">("products");
  const [myArticles, setMyArticles] = useState<any[]>([]);
  const itemsPerPage = 10;
  const router = useRouter();

  // Report Link Issue state
  const [reportingProduct, setReportingProduct] = useState<Product | null>(null);
  const [issueMessage, setIssueMessage] = useState("");
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState("");

  const openConfirm = (message: string, action: () => void) => {
    setConfirmMsg(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Site", "Category", "Trend Link", "Preview Link", "Remarks", "Status", "Links Count", "Added By", "Added At"];
    const rows = filtered.map((p) => [
      p.id.toString(),
      p.name,
      p.site.name,
      p.category.name,
      p.trendLink || "",
      p.previewLink || "",
      p.remarks || "",
      p.article?.status || "PENDING",
      (p.linkLogs?.length || 0).toString(),
      p.addedBy?.name || "",
      new Date(p.addedAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${(val || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully!");
  };

  const handleDeleteProduct = async (productId: number, productName: string) => {
    openConfirm(
      `Are you sure you want to delete "${productName}"? This will also delete all associated article tracking and link log entries.`,
      async () => {
        const uId = session?.user?.id || 1;
        try {
          const res = await fetch(`/api/products/${productId}?callerId=${uId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Failed to delete product");
          }
          toast.success("Product deleted successfully!");
          refreshProductsData(false);
        } catch (err: any) {
          toast.error(err.message || "Failed to delete product");
        }
      }
    );
  };

  const [userFilter, setUserFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [stats, setStats] = useState<any>(null);

  const refreshProductsData = (showLoading = false) => {
    if (!session?.user?.id) return;
    const mockUserId = session.user.id;
    const uRole = session.user.role || "WRITER";
    setCurrentUserRole(uRole);

    if (showLoading) setLoading(true);
    Promise.all([
      fetch(`/api/products?userId=${mockUserId}`).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/categories").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/dashboard?userId=${mockUserId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/articles?writerId=${mockUserId}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([productsData, categoriesData, dashboardData, articlesData]) => {
        const prods = Array.isArray(productsData) ? productsData : [];
        setProducts(prods);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setStats(dashboardData);
        setMyArticles(Array.isArray(articlesData) ? articlesData : []);
      })
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    refreshProductsData(true);

    if (!session?.user?.id) return;
    const currentUserId = session.user.id;

    // Live status updates via WebSocket
    let ws: WebSocket | null = null;
    try {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.host;
      ws = new WebSocket(`${wsProtocol}//${wsHost}/ws`);
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: "register", userId: currentUserId }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ARTICLE_STATUS_UPDATED" && msg.data) {
            const updated = msg.data;
            setProducts((prev) => {
              if (currentUserRole === "WRITER" && (updated.status === "COMPLETED" || updated.status === "APPROVED")) {
                return prev.filter((p) => p.id !== updated.productId);
              }
              return prev.map((p) =>
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
              );
            });
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

  const uniqueSites = Array.from(new Set(products.map((p) => p.site?.name).filter(Boolean))) as string[];
  const uniqueUsers = Array.from(
    new Set([
      ...products.map((p) => p.addedBy?.name),
      ...products.map((p) => p.article?.writer?.name),
    ].filter(Boolean))
  ) as string[];

  const filtered = products.filter((p) => {
    const s = search.toLowerCase();
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(s) ||
      (p.site?.name && p.site.name.toLowerCase().includes(s)) ||
      (p.category?.name && p.category.name.toLowerCase().includes(s)) ||
      (p.addedBy?.name && p.addedBy.name.toLowerCase().includes(s));

    const matchSite =
      !siteFilter ||
      p.site?.id?.toString() === siteFilter ||
      p.siteId?.toString() === siteFilter ||
      (p.site?.name && p.site.name.toLowerCase() === siteFilter.toLowerCase());

    const matchCategory =
      !categoryFilter ||
      p.category?.id?.toString() === categoryFilter ||
      p.categoryId?.toString() === categoryFilter ||
      (p.category?.name && p.category.name.toLowerCase() === categoryFilter.toLowerCase()) ||
      (p.productCategory && p.productCategory.toLowerCase() === categoryFilter.toLowerCase());
    
    // Status Filter
    let matchStatus = true;
    const currentStatus = p.article?.status || "PENDING";
    if (statusFilter) {
      matchStatus = currentStatus === statusFilter;
    } else if (currentUserRole === "WRITER") {
      // By default, remove completed & approved products from writer's available queue
      if (currentStatus === "COMPLETED" || currentStatus === "APPROVED") {
        matchStatus = false;
      }
    }

    // User filter (matches either Adder or Writer)
    const matchUser =
      !userFilter ||
      p.addedBy?.name === userFilter ||
      p.article?.writer?.name === userFilter;

    // Date Range filter
    let matchDate = true;
    if (startDate) {
      const sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      const d = new Date(p.addedAt);
      if (d < sDate) matchDate = false;
    }
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      const d = new Date(p.addedAt);
      if (d > eDate) matchDate = false;
    }

    return matchSearch && matchSite && matchCategory && matchStatus && matchUser && matchDate;
  });

  const activeFiltersCount = [
    Boolean(search),
    Boolean(siteFilter),
    Boolean(categoryFilter),
    Boolean(statusFilter),
    Boolean(userFilter),
    Boolean(startDate || endDate),
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSearch("");
    setSiteFilter("");
    setCategoryFilter("");
    setStatusFilter("");
    setUserFilter("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const filteredMyArticles = myArticles.filter((a: any) => {
    const s = search.toLowerCase();
    const matchSearch =
      !search ||
      (a.product?.name && a.product.name.toLowerCase().includes(s)) ||
      (a.product?.site?.name && a.product.site.name.toLowerCase().includes(s)) ||
      (a.product?.category?.name && a.product.category.name.toLowerCase().includes(s));

    const matchSite =
      !siteFilter ||
      a.product?.site?.id?.toString() === siteFilter ||
      (a.product?.site?.name && a.product.site.name.toLowerCase() === siteFilter.toLowerCase());

    const matchCategory =
      !categoryFilter ||
      a.product?.category?.id?.toString() === categoryFilter ||
      (a.product?.category?.name && a.product.category.name.toLowerCase() === categoryFilter.toLowerCase());

    const matchStatus = !statusFilter || a.status === statusFilter;

    return matchSearch && matchSite && matchCategory && matchStatus;
  });

  const activeTotalCount = activeTab === "products" ? filtered.length : filteredMyArticles.length;
  const totalPages = Math.ceil(activeTotalCount / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedMyArticles = filteredMyArticles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 py-3 px-2 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400">
          Showing {activeTotalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, activeTotalCount)} of {activeTotalCount}
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
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
            title="Previous Page"
          >
            &lt;
          </button>

          {start > 1 && (
            <button
              onClick={() => setCurrentPage(start - 1)}
              className="text-xs font-bold text-slate-400 hover:text-[#6D8196] px-1 cursor-pointer"
              title="Previous 5 Pages"
            >
              ...
            </button>
          )}

          {pages.map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentPage === p 
                  ? "bg-[#6D8196] text-white border border-[#6D8196] shadow-xs" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}

          {end < totalPages && (
            <button
              onClick={() => setCurrentPage(end + 1)}
              className="text-xs font-bold text-slate-400 hover:text-[#6D8196] px-1 cursor-pointer"
              title="Next 5 Pages"
            >
              ...
            </button>
          )}

          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  if (!mounted || sessionStatus === "loading") {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] flex items-center justify-center" suppressHydrationWarning>
        <LoadingScreen
          message="Loading products catalog..."
          subtext="Fetching indexed items, affiliate associations, and writer statuses"
          size="md"
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A]" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A] tracking-tight">Products</h1>
          <p className="text-[#737373] text-sm mt-0.5 font-medium">{filtered.length} products found</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "LINKER") && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-lg text-sm font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
          {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "LINKER") && (
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4 text-slate-500" />
              Import
            </button>
          )}
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition flex items-center gap-2 cursor-pointer">
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
              <p className="text-3xl font-bold text-slate-800">{stats.unlinkedProducts?.length || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Pending Products</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2"><Calendar className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general?.todaysProducts ?? stats.superAdmin?.todaysProducts ?? 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Today's Products</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-500 mb-2"><Globe className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general?.totalSites ?? stats.superAdmin?.totalSites ?? 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Sites</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-500 mb-2"><LayoutGrid className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.general?.totalCategories ?? stats.superAdmin?.totalCategories ?? 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Categories</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Selector: Available Products vs My Articles */}
      {(currentUserRole === "WRITER" || currentUserRole === "TEAM_LEAD" || myArticles.length > 0) && (
        <div className="flex items-center gap-2 border-b border-[#CBCBCB]/60 mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("products");
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "products"
                ? "border-[#6D8196] text-[#6D8196]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Available Products</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600">
              {filtered.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("my-articles");
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "my-articles"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>My Articles</span>
            {myArticles.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700">
                {myArticles.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#CBCBCB]/60 shadow-xs mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search products, sites, categories..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D8196] focus:border-transparent bg-slate-50 focus:bg-white transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); setCurrentPage(1); }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <CustomSelect
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
            placeholder="All Statuses"
            className="w-auto min-w-[135px]"
            triggerClassName="px-3.5 py-2 bg-white border border-slate-200 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
            options={[
              { value: "", label: "All Statuses" },
              { value: "PENDING", label: "Pending" },
              { value: "IN_PROGRESS", label: "In Progress" },
              { value: "COMPLETED", label: "Completed" },
              { value: "APPROVED", label: "Approved" },
              { value: "REDO", label: "Redo / Changes" },
            ]}
          />

          {/* Site Filter */}
          {uniqueSites.length > 0 && (
            <CustomSelect
              value={siteFilter}
              onChange={(val) => { setSiteFilter(val); setCurrentPage(1); }}
              placeholder="All Sites"
              className="w-auto min-w-[130px]"
              triggerClassName="px-3.5 py-2 bg-white border border-slate-200 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
              options={[
                { value: "", label: "All Sites" },
                ...uniqueSites.map((s) => ({ value: s, label: s })),
              ]}
            />
          )}

          {/* Product Type (Category) Filter */}
          <CustomSelect
            value={categoryFilter}
            onChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}
            placeholder="All Product Types"
            className="w-auto min-w-[145px]"
            triggerClassName="px-3.5 py-2 bg-white border border-slate-200 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
            options={[
              { value: "", label: "All Product Types" },
              ...categories.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
          />

          {/* User Filter */}
          <CustomSelect
            value={userFilter}
            onChange={(val) => { setUserFilter(val); setCurrentPage(1); }}
            placeholder="All Users"
            className="w-auto min-w-[130px]"
            triggerClassName="px-3.5 py-2 bg-white border border-slate-200 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
            options={[
              { value: "", label: "All Users" },
              ...uniqueUsers.map((u) => ({ value: u, label: u })),
            ]}
          />

          {/* Date Range Picker */}
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              setCurrentPage(1);
            }}
            placeholder="Select Date Range"
          />

          {/* Reset Filters Action */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset ({activeFiltersCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12">
            <LoadingScreen
              message="Loading products catalog..."
              subtext="Fetching indexed items, affiliate associations, and writer statuses"
              size="md"
            />
          </div>
        ) : activeTab === "products" ? (
          filtered.length === 0 ? (
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
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Type</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Affiliate</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trend</th>
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
                              className="text-[13px] font-semibold text-[#6D8196] hover:text-[#4A4A4A] hover:underline inline-flex items-center gap-1"
                            >
                              <span>{p.site.name}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            </a>
                          ) : (
                            <span className="text-[13px] font-semibold text-slate-800">{p.site?.name || "-"}</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[13px] font-medium text-slate-600">
                            {p.productCategory || p.category?.name}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border border-slate-200 bg-slate-50 text-slate-700">
                            {p.category?.name || "Ecom"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border border-slate-200 bg-slate-50 text-slate-600">
                            {p.affiliateName || "General"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            p.trendLevel === "HIGH" 
                              ? "bg-rose-50 text-rose-600 border border-rose-100" 
                              : p.trendLevel === "MODERATE" 
                              ? "bg-amber-50 text-amber-600 border border-amber-100" 
                              : "bg-slate-50 text-slate-600 border border-slate-100"
                          }`}>
                            {p.trendLevel === "HIGH" && <Flame className="w-3 h-3 text-rose-500" />}
                            {p.trendLevel === "MODERATE" && <TrendingUp className="w-3 h-3 text-amber-500" />}
                            {p.trendLevel === "HIGH" ? "High" : p.trendLevel === "MODERATE" ? "Moderate" : "Low"}
                          </span>
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
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#CBCBCB] bg-white text-[#4A4A4A] hover:text-[#6D8196] hover:border-[#6D8196] hover:bg-[#FAF9F5] transition-all text-[11px] font-semibold whitespace-nowrap shadow-2xs"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Review
                              </Link>
                            ) : (
                              <button
                                onClick={() => setSelectedProduct(p)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#CBCBCB] bg-white text-[#4A4A4A] hover:text-[#6D8196] hover:border-[#6D8196] hover:bg-[#FAF9F5] transition-all text-[11px] font-semibold whitespace-nowrap cursor-pointer shadow-2xs"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Preview
                              </button>
                            )}

                            {/* WRITER & TEAM_LEAD: Write button / Taken button */}
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
                                      toast.success("Started! Redirecting to tracker...");
                                      setTimeout(() => { window.location.href = "/#writer-tracker"; }, 600);
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
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-2xs active:scale-98"
                                    : "bg-slate-100 text-slate-500 border border-slate-200/80 cursor-not-allowed"
                                }`}
                                title={
                                  status !== "PENDING"
                                    ? p.article?.writer?.name
                                      ? `Taken by ${p.article.writer.name}`
                                      : "Article already taken"
                                    : "Click to start writing this article"
                                }
                              >
                                {status === "PENDING" ? (
                                  <>
                                    <PlayCircle className="w-3.5 h-3.5" />
                                    Write
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                                    Taken
                                  </>
                                )}
                              </button>
                            )}

                            {/* Report Link Issue (Red Triangle Button) */}
                            {(() => {
                              const hasIssue = p.linkLogs?.some((l: any) => l.status === "ISSUE");
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReportingProduct(p);
                                    setIssueMessage("");
                                  }}
                                  title={hasIssue ? "Link issue flagged (Click to view/update)" : "Report Link Issue"}
                                  className={`inline-flex items-center justify-center p-1.5 rounded-md border transition-all cursor-pointer shadow-2xs ${
                                    hasIssue
                                      ? "bg-rose-600 text-white border-rose-700 animate-pulse hover:bg-rose-700"
                                      : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-700"
                                  }`}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              );
                            })()}

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
          )
        ) : (
          /* activeTab === "my-articles" */
          filteredMyArticles.length === 0 ? (
            <div className="p-16 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-slate-600 font-bold text-sm">No articles in your queue yet</p>
              <p className="text-slate-400 text-xs">Switch to &ldquo;Available Products&rdquo; above and click &ldquo;Write&rdquo; to start your first article!</p>
            </div>
          ) : (
            <div className="overflow-x-auto p-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Article / Product</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Site</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Type</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Article Link</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Updated</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedMyArticles.map((a: any) => {
                    const status = a.status || "PENDING";
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-3 py-3.5">
                          <span className="text-[13px] font-semibold text-slate-800">{a.product?.name}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          {a.product?.site?.url ? (
                            <a
                              href={a.product.site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[13px] font-semibold text-[#6D8196] hover:text-[#4A4A4A] hover:underline inline-flex items-center gap-1"
                            >
                              <span>{a.product.site.name}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          ) : (
                            <span className="text-[13px] font-medium text-slate-600">{a.product?.site?.name || "-"}</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[13px] font-medium text-slate-600">
                            {a.product?.productCategory || a.product?.category?.name || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border border-slate-200 bg-slate-50 text-slate-700">
                            {a.product?.category?.name || "Ecom"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${STATUS_COLORS[status] || STATUS_COLORS.PENDING}`}>
                            {status === "IN_PROGRESS" ? "In Progress" : status.charAt(0) + status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          {a.articleLink ? (
                            <a
                              href={a.articleLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline max-w-[140px] truncate"
                            >
                              <span>View Link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Not submitted</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[12px] font-medium text-slate-500">
                            {new Date(a.updatedAt || a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {status === "IN_PROGRESS" || status === "REDO" ? (
                              <button
                                onClick={() => {
                                  window.location.href = "/#writer-tracker";
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-2xs cursor-pointer"
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                                Continue Writing
                              </button>
                            ) : (
                              <Link
                                href={`/articles/${a.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#CBCBCB] bg-white text-[#4A4A4A] hover:text-[#6D8196] hover:border-[#6D8196] hover:bg-[#FAF9F5] transition-all text-[11px] font-semibold whitespace-nowrap shadow-2xs"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Review
                              </Link>
                            )}

                            {/* Report link issue button */}
                            {a.product && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReportingProduct(a.product);
                                  setIssueMessage("");
                                }}
                                title="Report Link Issue"
                                className="inline-flex items-center justify-center p-1.5 rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer shadow-2xs"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
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
          )
        )}
      </div>

      <AddProductModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => {
          setIsAddModalOpen(false);
          refreshProductsData(false);
        }}
      />

      <EditProductModal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        onSuccess={() => {
          setEditingProduct(null);
          refreshProductsData(false);
        }}
        product={editingProduct}
      />

      <ImportProductModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setIsImportModalOpen(false);
          refreshProductsData(false);
        }}
        userId={session?.user?.id ? Number(session.user.id) : 1}
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
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-[#6D8196]" /> {selectedProduct.site.name}</span>
                  <span className="flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 text-[#6D8196]" /> Product Type: {selectedProduct.category?.name || "—"}</span>
                  <span className="flex items-center gap-1.5"><Tag className="w-4 h-4 text-[#6D8196]" /> Category: {selectedProduct.productCategory || "—"}</span>
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
                          <FormattedRemarks remarks={log.linkerRemarks} textClass="text-[10px]" />
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
                        toast.success("Started! Redirecting to tracker...");
                        setTimeout(() => { window.location.href = "/#writer-tracker"; }, 600);
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

              {currentUserRole !== "WRITER" && currentUserRole !== "LINKER" && selectedProduct.article && (
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
      {/* Report Link Issue Modal */}
      {reportingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Report Link Issue</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Alert linkers and admins about broken or invalid links</p>
                </div>
              </div>
              <button
                onClick={() => setReportingProduct(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#CBCBCB]/70 text-xs space-y-1">
              <div>
                <span className="text-slate-500 font-medium">Product:</span>{" "}
                <strong className="text-slate-800">{reportingProduct.name}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Site:</span>{" "}
                <strong className="text-slate-800">{reportingProduct.site?.name}</strong>
              </div>
              {reportingProduct.affiliateName && (
                <div>
                  <span className="text-slate-500 font-medium">Affiliate:</span>{" "}
                  <strong className="text-slate-800">{reportingProduct.affiliateName}</strong>
                </div>
              )}
              {reportingProduct.linkLogs && reportingProduct.linkLogs.length > 0 && (
                <div>
                  <span className="text-slate-500 font-medium">Configured Links:</span>{" "}
                  <span className="text-slate-700 font-semibold">{reportingProduct.linkLogs.length} link log(s)</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider">
                Issue Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={issueMessage}
                onChange={(e) => setIssueMessage(e.target.value)}
                placeholder="Describe the issue (e.g. 404 dead link, wrong redirect, expired offer, broken affiliate tag)..."
                className="w-full px-3.5 py-2.5 bg-white border border-[#CBCBCB] rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-2xs resize-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setReportingProduct(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer transition shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingIssue || !issueMessage.trim()}
                onClick={async () => {
                  if (!issueMessage.trim()) return;
                  setSubmittingIssue(true);
                  try {
                    const res = await fetch(`/api/products/${reportingProduct.id}/report-link-issue`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ issueMessage: issueMessage.trim() }),
                    });
                    if (res.ok) {
                      toast.success("Link issue reported to linkers!");
                      setReportingProduct(null);
                      refreshProductsData();
                    } else {
                      const err = await res.json();
                      toast.error(err.error || "Failed to report issue");
                    }
                  } catch (err: any) {
                    toast.error(err.message || "Failed to report issue");
                  } finally {
                    setSubmittingIssue(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold disabled:opacity-50 cursor-pointer transition shadow-xs flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {submittingIssue ? "Reporting..." : "Send Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Product"
        message={confirmMsg}
        confirmLabel="Delete Product"
        variant="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          confirmAction?.();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
