"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { Search, Plus, Upload, Download, SlidersHorizontal, ExternalLink, FileText, LayoutGrid, Globe, PlayCircle, X, Copy, Clock, Calendar, Package, Edit, Trash2, Flame, TrendingUp, ChevronDown, Tag, AlertTriangle, Lock, CheckCircle2, MessageSquare, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import FormattedRemarks from "@/components/FormattedRemarks";
import AddProductModal from "@/components/AddProductModal";
import EditProductModal from "@/components/EditProductModal";
import ImportProductModal from "@/components/ImportProductModal";
import AssignmentDetailsModal from "@/components/AssignmentDetailsModal";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import CustomSelect from "@/components/CustomSelect";
import DateRangePicker from "@/components/DateRangePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingScreen from "@/components/LoadingScreen";
import { fuzzyMatchAny } from "@/lib/fuzzy";

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  slug?: string | null;
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
  article?: { id: number; status: string; writer?: { id?: number; name: string }; articleLink?: string | null };
  linkLogs?: any[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60",
  COMPLETED: "bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60",
  APPROVED: "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60",
  REDO: "bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60",
};

function ProductsPageContent() {
  const { data: session, status: sessionStatus } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlSearch = searchParams.get("search");
  const urlStatus = searchParams.get("status");
  const urlSite = searchParams.get("site");
  const urlCategory = searchParams.get("category");

  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(urlSearch || "");
  const [siteFilter, setSiteFilter] = useState(urlSite || "");
  const [categoryFilter, setCategoryFilter] = useState(urlCategory || "");
  const [statusFilter, setStatusFilter] = useState(urlStatus || "");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<"products" | "my-articles">("products");
  const [myArticles, setMyArticles] = useState<any[]>([]);
  const itemsPerPage = 10;

  // Sync search and filter params whenever searchParams changes (e.g. from notification click)
  useEffect(() => {
    const s = searchParams.get("search");
    const st = searchParams.get("status");
    const site = searchParams.get("site");
    const cat = searchParams.get("category");

    if (s !== null) {
      setSearch(s);
      setStatusFilter(st || "");
      setSiteFilter(site || "");
      setCategoryFilter(cat || "");
      setUserFilter("");
      setStartDate("");
      setEndDate("");
      setCurrentPage(1);
    } else {
      if (st !== null) setStatusFilter(st);
      if (site !== null) setSiteFilter(site);
      if (cat !== null) setCategoryFilter(cat);
      if (st !== null || site !== null || cat !== null) {
        setCurrentPage(1);
      }
    }
  }, [searchParams]);

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
      (!p.article?.writer && (p.article?.status === "APPROVED" || p.article?.status === "COMPLETED" || p.article?.status === "IN_PROGRESS"))
        ? "PENDING"
        : p.article?.status || "PENDING",
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
        } catch (e) { }
      };
      ws.onerror = () => { };
    } catch (e) { }

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
    const matchSearch =
      !search ||
      fuzzyMatchAny(
        [
          p.name,
          p.slug,
          p.site?.name,
          p.category?.name,
          p.productCategory,
          p.affiliateName,
          p.addedBy?.name,
        ],
        search
      );

    const matchSite =
      !siteFilter ||
      p.site?.id?.toString() === siteFilter ||
      p.siteId?.toString() === siteFilter ||
      (p.site?.name && p.site.name.toLowerCase() === siteFilter.toLowerCase());

    const selectedCategoryObj = categories.find(
      (c) => String(c.id) === categoryFilter || c.name.toLowerCase() === categoryFilter.toLowerCase()
    );
    const selectedCategoryName = selectedCategoryObj ? selectedCategoryObj.name.toLowerCase() : categoryFilter.toLowerCase();
    const selectedCategoryIdStr = selectedCategoryObj ? String(selectedCategoryObj.id) : categoryFilter;

    const matchCategory =
      !categoryFilter ||
      p.category?.id?.toString() === selectedCategoryIdStr ||
      p.categoryId?.toString() === selectedCategoryIdStr ||
      (p.category?.name && p.category.name.toLowerCase() === selectedCategoryName) ||
      (p.productCategory && p.productCategory.toLowerCase() === selectedCategoryName);

    // Status Filter
    let matchStatus = true;
    const hasWriter = Boolean(p.article?.writer?.id || p.article?.writer?.name);
    const rawStatus = p.article?.status || "PENDING";
    const currentStatus = (!hasWriter && (rawStatus === "APPROVED" || rawStatus === "COMPLETED" || rawStatus === "IN_PROGRESS"))
      ? "PENDING"
      : rawStatus;
    if (statusFilter === "NO_LINKS") {
      const isPub = Boolean(p.article?.articleLink || rawStatus === "APPROVED" || rawStatus === "COMPLETED");
      const hasLinks = p.linkLogs && p.linkLogs.length > 0 && p.linkLogs.some((l: any) => l.affiliateLink || (l.geos && l.geos.length > 0));
      matchStatus = isPub && !hasLinks;
    } else if (statusFilter) {
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
    const matchSearch =
      !search ||
      fuzzyMatchAny(
        [
          a.product?.name,
          a.product?.slug,
          a.product?.site?.name,
          a.product?.category?.name,
          a.product?.productCategory,
          a.product?.affiliateName,
        ],
        search
      );

    const matchSite =
      !siteFilter ||
      a.product?.site?.id?.toString() === siteFilter ||
      (a.product?.site?.name && a.product.site.name.toLowerCase() === siteFilter.toLowerCase());

    const selectedCategoryObj = categories.find(
      (c) => String(c.id) === categoryFilter || c.name.toLowerCase() === categoryFilter.toLowerCase()
    );
    const selectedCategoryName = selectedCategoryObj ? selectedCategoryObj.name.toLowerCase() : categoryFilter.toLowerCase();
    const selectedCategoryIdStr = selectedCategoryObj ? String(selectedCategoryObj.id) : categoryFilter;

    const matchCategory =
      !categoryFilter ||
      a.product?.category?.id?.toString() === selectedCategoryIdStr ||
      (a.product?.category?.name && a.product.category.name.toLowerCase() === selectedCategoryName) ||
      (a.product?.productCategory && a.product.productCategory.toLowerCase() === selectedCategoryName);

    const matchStatus = statusFilter === "NO_LINKS"
      ? (() => {
          const isPub = Boolean(a.articleLink || a.status === "APPROVED" || a.status === "COMPLETED");
          const mProd = products.find((p) => p.id === (a.productId || a.product?.id));
          const pLogs = mProd?.linkLogs || a.product?.linkLogs || [];
          const hasLinks = pLogs.length > 0 && pLogs.some((l: any) => l.affiliateLink || (l.geos && l.geos.length > 0));
          return isPub && !hasLinks;
        })()
      : (!statusFilter || a.status === statusFilter);

    return matchSearch && matchSite && matchCategory && matchStatus;
  });

  const sortedFiltered = useMemo(() => {
    if (!search || !search.trim()) return filtered;
    const q = search.trim().toLowerCase();
    return [...filtered].sort((a, b) => {
      const aName = (a.name || "").toLowerCase();
      const bName = (b.name || "").toLowerCase();
      const aExact = aName === q ? 3 : aName.startsWith(q) ? 2 : (a.slug || "").toLowerCase().startsWith(q) ? 1 : 0;
      const bExact = bName === q ? 3 : bName.startsWith(q) ? 2 : (b.slug || "").toLowerCase().startsWith(q) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return 0;
    });
  }, [filtered, search]);

  const sortedFilteredMyArticles = useMemo(() => {
    if (!search || !search.trim()) return filteredMyArticles;
    const q = search.trim().toLowerCase();
    return [...filteredMyArticles].sort((a, b) => {
      const aName = (a.product?.name || "").toLowerCase();
      const bName = (b.product?.name || "").toLowerCase();
      const aExact = aName === q ? 3 : aName.startsWith(q) ? 2 : (a.product?.slug || "").toLowerCase().startsWith(q) ? 1 : 0;
      const bExact = bName === q ? 3 : bName.startsWith(q) ? 2 : (b.product?.slug || "").toLowerCase().startsWith(q) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return 0;
    });
  }, [filteredMyArticles, search]);

  const handleViewProductDetails = (a: any) => {
    if (!a?.product) return;
    const matchingProd = products.find((p) => p.id === (a.productId || a.product?.id));
    const baseProduct = matchingProd || a.product;
    const fullProd = {
      ...baseProduct,
      site: baseProduct.site || a.product.site,
      category: baseProduct.category || a.product.category,
      addedBy: baseProduct.addedBy || a.product.addedBy,
      linkLogs: (baseProduct.linkLogs && baseProduct.linkLogs.length > 0)
        ? baseProduct.linkLogs
        : (a.product.linkLogs || []),
      article: {
        id: a.id,
        status: a.status,
        priority: a.priority,
        writer: a.writer || baseProduct.article?.writer,
      },
    };
    setSelectedProduct(fullProd as any);
  };

  const activeTotalCount = activeTab === "products" ? sortedFiltered.length : sortedFilteredMyArticles.length;
  const totalPages = Math.ceil(activeTotalCount / itemsPerPage);
  const paginated = sortedFiltered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedMyArticles = sortedFilteredMyArticles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${currentPage === p
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
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-950/60 flex items-center justify-center text-violet-500 dark:text-violet-400 mb-2"><Package className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.general.totalProducts || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Total Products</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-500 dark:text-amber-400 mb-2"><Clock className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.unlinkedProducts?.length || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Pending Products</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-2"><Calendar className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.general?.todaysProducts ?? stats.superAdmin?.todaysProducts ?? 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Today's Products</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-500 dark:text-teal-400 mb-2"><Globe className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.general?.totalSites ?? stats.superAdmin?.totalSites ?? 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Total Sites</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-500 dark:text-sky-400 mb-2"><LayoutGrid className="w-4 h-4" /></div>
            <div>
              <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.general?.totalCategories ?? stats.superAdmin?.totalCategories ?? 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Total Categories</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Selector: Available Products vs My Articles */}
      {(currentUserRole === "WRITER" || currentUserRole === "TEAM_LEAD" || myArticles.length > 0) && (
        <div className="flex items-center gap-2 border-b border-[#CBCBCB]/60 dark:border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("products");
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === "products"
                ? "border-[#6D8196] text-[#6D8196] dark:border-sky-400 dark:text-sky-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
          >
            <Package className="w-4 h-4" />
            <span>Available Products</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {filtered.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("my-articles");
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === "my-articles"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
          >
            <FileText className="w-4 h-4" />
            <span>My Articles</span>
            {myArticles.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                {myArticles.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs mb-6">
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
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6D8196] focus:border-transparent bg-slate-50 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); router.replace("/products"); setCurrentPage(1); }}
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
            minWidth={160}
            triggerClassName="w-full px-3.5 py-2 bg-white border border-slate-200 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
            options={[
              { value: "", label: "All Statuses" },
              { value: "PENDING", label: "Pending" },
              { value: "IN_PROGRESS", label: "In Progress" },
              { value: "COMPLETED", label: "Completed" },
              { value: "APPROVED", label: "Approved" },
              { value: "REDO", label: "Redo / Changes" },
              { value: "NO_LINKS", label: "⚠️ Published (No Links)" },
            ]}
          />

          {/* Site Filter */}
          {uniqueSites.length > 0 && (
            <CustomSelect
              value={siteFilter}
              onChange={(val) => { setSiteFilter(val); setCurrentPage(1); }}
              placeholder="All Sites"
              className="w-auto min-w-[130px]"
              minWidth={160}
              triggerClassName="w-full px-3.5 py-2 bg-white border border-slate-200 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
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
            minWidth={175}
            triggerClassName="w-full px-3.5 py-2 bg-white border border-slate-200 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
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
            minWidth={160}
            triggerClassName="w-full px-3.5 py-2 bg-white border border-slate-200 hover:border-[#6D8196] rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
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
            disableFutureDates={true}
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
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
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
              <p className="text-slate-500 dark:text-slate-400 font-medium">No products found</p>
            </div>
          ) : (
            <div className="overflow-x-auto p-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Product Name</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Site</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Category</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Product Type</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Affiliate</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Trend</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Added By</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Date</th>
                    {(currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD") && (
                      <th className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    )}
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-center">Links</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                  {paginated.map((p: any) => {
                    const hasWriter = Boolean(p.article?.writer?.id || p.article?.writer?.name);
                    const rawStatus = p.article?.status || "PENDING";
                    const status = (!hasWriter && (rawStatus === "APPROVED" || rawStatus === "COMPLETED" || rawStatus === "IN_PROGRESS"))
                      ? "PENDING"
                      : rawStatus;

                    const isPublished = Boolean(p.article?.articleLink || rawStatus === "APPROVED" || rawStatus === "COMPLETED");
                    const hasLinks = p.linkLogs && p.linkLogs.length > 0 && p.linkLogs.some((l: any) => l.affiliateLink || (l.geos && l.geos.length > 0));
                    const isPublishedWithoutLinks = isPublished && !hasLinks;

                    return (
                      <tr key={p.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group ${isPublishedWithoutLinks ? "bg-rose-50/20 dark:bg-rose-950/20" : ""}`}>
                        <td className={`px-3 py-3.5 transition-colors ${isPublishedWithoutLinks ? "bg-rose-50/70 dark:bg-rose-950/40 border-l-4 border-l-rose-500" : ""}`}>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSelectedProduct(p)}
                                className={`text-[13px] font-bold text-left cursor-pointer transition-colors ${
                                  isPublishedWithoutLinks
                                    ? "text-rose-900 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 underline decoration-rose-400"
                                    : "text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-sky-400 hover:underline"
                                }`}
                                title="Click to view product details"
                              >
                                {p.name}
                              </button>
                              {isPublishedWithoutLinks && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60 shadow-2xs whitespace-nowrap"
                                  title="Article is published, but this product has NO affiliate links configured!"
                                >
                                  <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                  No Links
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 block truncate">
                              /{p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          {p.site?.url ? (
                            <a
                              href={p.site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[13px] font-semibold text-[#6D8196] dark:text-sky-400 hover:text-[#4A4A4A] dark:hover:text-white hover:underline inline-flex items-center gap-1"
                            >
                              <span>{p.site.name}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            </a>
                          ) : (
                            <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{p.site?.name || "-"}</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
                            {p.productCategory || p.category?.name}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            {p.category?.name || "Ecom"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {p.affiliateName || "General"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${p.trendLevel === "HIGH"
                              ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 border border-rose-100 dark:border-rose-900/60"
                              : p.trendLevel === "MODERATE"
                                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60"
                                : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700"
                            }`}>
                            {p.trendLevel === "HIGH" && <Flame className="w-3 h-3 text-rose-500" />}
                            {p.trendLevel === "MODERATE" && <TrendingUp className="w-3 h-3 text-amber-500" />}
                            {p.trendLevel === "HIGH" ? "High" : p.trendLevel === "MODERATE" ? "Moderate" : "Low"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">{p.addedBy?.name}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
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
                        <td className={`px-3 py-3.5 text-center transition-colors ${isPublishedWithoutLinks ? "bg-rose-50/40 dark:bg-rose-950/30" : ""}`}>
                          {isPublishedWithoutLinks ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60 shadow-2xs"
                              title="Missing affiliate links for published article"
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              0 Links
                            </span>
                          ) : (
                            <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{p.linkLogs?.length || 0}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {/* Review - for Admin/Team Lead, link to article; for others, show product modal */}
                            {p.article && (currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN" || currentUserRole === "TEAM_LEAD") ? (
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/articles/${p.article.id}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#CBCBCB] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#4A4A4A] dark:text-slate-200 hover:text-[#6D8196] dark:hover:text-sky-300 hover:border-[#6D8196] dark:hover:border-sky-500/50 hover:bg-[#FAF9F5] dark:hover:bg-slate-700/60 transition-all text-[11px] font-semibold whitespace-nowrap shadow-2xs"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Review
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setSelectedProduct(p)}
                                  title="View Product Details"
                                  aria-label="View Product Details"
                                  className="inline-flex items-center justify-center p-1.5 rounded-md border border-blue-200 dark:border-blue-800/70 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/70 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer shadow-2xs"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSelectedProduct(p)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#CBCBCB] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#4A4A4A] dark:text-slate-200 hover:text-[#6D8196] dark:hover:text-sky-300 hover:border-[#6D8196] dark:hover:border-sky-500/50 hover:bg-[#FAF9F5] dark:hover:bg-slate-700/60 transition-all text-[11px] font-semibold whitespace-nowrap cursor-pointer shadow-2xs"
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
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${status === "PENDING"
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-2xs active:scale-98"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700 cursor-not-allowed"
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
                                    <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                    Taken
                                  </>
                                )}
                              </button>
                            )}

                            {/* Report Link Issue (Red Triangle Button) */}
                            {(() => {
                              const hasIssue = p.linkLogs?.some((l: any) => l.status === "ISSUE");
                              const remarksList = (p.linkLogs || [])
                                .map((l: any) => l.linkerRemarks)
                                .filter(Boolean);
                              const hasRemarks = remarksList.length > 0;
                              const firstRemark = remarksList[0];

                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReportingProduct(p);
                                    setIssueMessage("");
                                  }}
                                  title={
                                    hasIssue
                                      ? `Link issue flagged: ${firstRemark || "Click to view/update"}`
                                      : hasRemarks
                                        ? `Existing remark: ${firstRemark}`
                                        : "Report Link Issue"
                                  }
                                  className={`inline-flex items-center justify-center p-1.5 rounded-md border transition-all cursor-pointer shadow-2xs ${hasIssue
                                      ? "bg-rose-600 text-white border-rose-700 animate-pulse hover:bg-rose-700"
                                      : hasRemarks
                                        ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:border-amber-400"
                                        : "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 hover:border-rose-300 hover:text-rose-700 dark:hover:text-rose-200"
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
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.id, p.name)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all text-[11px] font-semibold whitespace-nowrap cursor-pointer"
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
              <table className="w-full text-left min-w-[950px]">
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
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                  {paginatedMyArticles.map((a: any) => {
                    const status = a.status || "PENDING";
                    const matchingProd = products.find((p) => p.id === (a.productId || a.product?.id));
                    const prodLinkLogs = matchingProd?.linkLogs || a.product?.linkLogs || [];
                    const isPublished = Boolean(a.articleLink || status === "APPROVED" || status === "COMPLETED");
                    const hasLinks = prodLinkLogs.length > 0 && prodLinkLogs.some((l: any) => l.affiliateLink || (l.geos && l.geos.length > 0));
                    const isPublishedWithoutLinks = isPublished && !hasLinks;
                    return (
                      <tr key={a.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group ${isPublishedWithoutLinks ? "bg-rose-50/20 dark:bg-rose-950/20" : ""}`}>
                        <td className={`px-3 py-3.5 transition-colors ${isPublishedWithoutLinks ? "bg-rose-50/70 dark:bg-rose-950/40 border-l-4 border-l-rose-500" : ""}`}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleViewProductDetails(a)}
                              className={`text-[13px] font-bold text-left cursor-pointer transition-colors ${
                                isPublishedWithoutLinks
                                  ? "text-rose-900 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 underline decoration-rose-400"
                                  : "text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-sky-400 hover:underline"
                              }`}
                              title="Click to view product details"
                            >
                              {a.product?.name}
                            </button>
                            {isPublishedWithoutLinks && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60 shadow-2xs whitespace-nowrap"
                                title="Article is published, but this product has NO affiliate links configured!"
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                No Links
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 block truncate">
                            /{a.product?.slug || a.product?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          {a.product?.site?.url ? (
                            <a
                              href={a.product.site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[13px] font-semibold text-[#6D8196] dark:text-sky-400 hover:text-[#4A4A4A] dark:hover:text-white hover:underline inline-flex items-center gap-1"
                            >
                              <span>{a.product.site.name}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            </a>
                          ) : (
                            <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">{a.product?.site?.name || "-"}</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
                            {a.product?.productCategory || a.product?.category?.name || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
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
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline max-w-[140px] truncate"
                            >
                              <span>View Link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500 italic">Not submitted</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                            {new Date(a.updatedAt || a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2 flex-nowrap">
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
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#CBCBCB] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#4A4A4A] dark:text-slate-200 hover:text-[#6D8196] dark:hover:text-sky-300 hover:border-[#6D8196] dark:hover:border-sky-500/50 hover:bg-[#FAF9F5] dark:hover:bg-slate-700/60 transition-all text-[11px] font-semibold whitespace-nowrap shadow-2xs"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Review
                              </Link>
                            )}

                            {/* View Product Details button */}
                            {a.product && (
                              <button
                                type="button"
                                onClick={() => handleViewProductDetails(a)}
                                title="View Product Details"
                                aria-label="View Product Details"
                                className="inline-flex items-center justify-center p-1.5 rounded-md border border-blue-200 dark:border-blue-800/70 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/70 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer shadow-2xs shrink-0"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
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
                                className="inline-flex items-center justify-center p-1.5 rounded-md border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 hover:border-rose-300 dark:hover:border-rose-700 transition-all cursor-pointer shadow-2xs shrink-0"
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
        <AssignmentDetailsModal
          product={selectedProduct as any}
          currentUserRole={currentUserRole}
          currentUserId={session?.user?.id}
          onClose={() => setSelectedProduct(null)}
          onReportIssue={(prod) => {
            setSelectedProduct(null);
            setReportingProduct(prod as any);
          }}
        />
      )}
      {/* Report Link Issue Modal */}
      {reportingProduct && (() => {
        const linkLogsWithRemarks = (reportingProduct.linkLogs || []).filter(
          (l: any) =>
            (l.status === "ISSUE" || (l.linkerRemarks && l.linkerRemarks.includes("[Flagged by"))) &&
            l.linkerRemarks &&
            l.linkerRemarks.trim().length > 0
        );
        const hasAnyBeforeRemark = linkLogsWithRemarks.length > 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-100 dark:border-slate-800 animate-scaleIn max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Report Link Issue</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Alert linkers and admins about broken or invalid links</p>
                  </div>
                </div>
                <button
                  onClick={() => setReportingProduct(null)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Product Info & Links Summary */}
              <div className="p-3.5 bg-[#FAF9F5] dark:bg-slate-800/70 rounded-xl border border-[#CBCBCB]/70 dark:border-slate-700 text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium block text-[11px]">Product:</span>{" "}
                    <strong className="text-slate-800 dark:text-slate-100 text-xs">{reportingProduct.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium block text-[11px]">Site:</span>{" "}
                    <strong className="text-slate-800 dark:text-slate-100 text-xs">{reportingProduct.site?.name}</strong>
                  </div>
                </div>
                {reportingProduct.affiliateName && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Affiliate:</span>{" "}
                    <strong className="text-slate-800 dark:text-slate-100">{reportingProduct.affiliateName}</strong>
                  </div>
                )}
                {reportingProduct.linkLogs && reportingProduct.linkLogs.length > 0 && (
                  <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400 font-medium block text-[11px] mb-1">
                      Configured Links ({reportingProduct.linkLogs.length}):
                    </span>
                    <div className="space-y-1">
                      {reportingProduct.linkLogs.map((l: any, idx: number) => (
                        <div
                          key={l.id || idx}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[11px]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{l.affiliateName || "Link"}</span>
                            {l.affiliateLink && (
                              <a
                                href={l.affiliateLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-600 dark:text-sky-400 hover:underline truncate max-w-[180px] font-mono"
                              >
                                {l.affiliateLink}
                              </a>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${l.status === "ISSUE"
                                ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                                : l.status === "ACCEPTED"
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                                  : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
                              }`}
                          >
                            {l.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Before Remarks */}
              {hasAnyBeforeRemark && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                      Before Remarks
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                      Before Remark
                    </span>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-2.5 p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/50 shadow-2xs">
                    {linkLogsWithRemarks.map((l: any, idx: number) => (
                      <div key={l.id || idx} className="space-y-1">
                        {linkLogsWithRemarks.length > 1 && (
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200">
                              {l.affiliateName || "Link"}
                            </span>
                            <span>•</span>
                            <span className="uppercase text-[9px] font-bold text-slate-500 dark:text-slate-400">Status: {l.status}</span>
                          </div>
                        )}
                        <FormattedRemarks remarks={l.linkerRemarks} date={l.updatedAt || l.addedAt} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#4A4A4A] dark:text-slate-200 uppercase tracking-wider">
                    Issue Description <span className="text-rose-500">*</span>
                  </label>
                  {hasAnyBeforeRemark && (
                    <button
                      type="button"
                      onClick={() => {
                        const prev = linkLogsWithRemarks.map((l: any) => l.linkerRemarks).join("\n");
                        setIssueMessage((curr) => (curr ? `${curr}\n${prev}` : prev));
                      }}
                      className="text-[10px] font-semibold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Copy Before Remark
                    </button>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={issueMessage}
                  onChange={(e) => setIssueMessage(e.target.value)}
                  placeholder="Describe the issue (e.g. 404 dead link, wrong redirect, expired offer, broken affiliate tag)..."
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-[#CBCBCB] dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-2xs resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setReportingProduct(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition shadow-2xs"
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
        );
      })()}

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

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ProductsPageContent />
    </Suspense>
  );
}
