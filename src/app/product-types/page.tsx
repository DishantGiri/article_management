/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, X, Trash2, Edit, AlertCircle } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingScreen from "@/components/LoadingScreen";
import TopHeader from "@/components/TopHeader";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";

interface ProductType {
  id: number;
  name: string;
  _count?: { sites: number; products: number };
}

interface ProductCategory {
  id: number;
  name: string;
  createdAt: string;
}

export default function ProductTypesAndCategoriesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Product Type modal states
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [isEditTypeModalOpen, setIsEditTypeModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ProductType | null>(null);
  const [typeName, setTypeName] = useState("");

  // Product Category modal states
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [catName, setCatName] = useState("");

  // Common form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const userRole = session?.user?.role;
  const canManage =
    userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "LINKER";

  const fetchData = async () => {
    setLoading(true);
    try {
      const [typesRes, catsRes, notifsRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/product-categories"),
        session?.user?.id ? fetch(`/api/notifications?userId=${session.user.id}`) : Promise.resolve(null),
      ]);

      if (typesRes.ok) {
        const types = await typesRes.json();
        setProductTypes(Array.isArray(types) ? types : []);
      }
      if (catsRes.ok) {
        const cats = await catsRes.json();
        setProductCategories(Array.isArray(cats) ? cats : []);
      }
      if (notifsRes && notifsRes.ok) {
        const notifs = await notifsRes.json();
        setNotifications(Array.isArray(notifs) ? notifs : []);
      }
    } catch (err) {
      console.error("Failed to load data", err);
      toast.error("Failed to load types and categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session?.user?.id]);

  const handleMarkAllAsRead = async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (err) {}
  };

  const handleNotificationClick = (notif: any) => {
    if (!notif.isRead) {
      fetch(`/api/notifications/${notif.id}/read`, { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
    }
  };

  // ─── PRODUCT TYPE HANDLERS ─────────────────────────────────
  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = typeName.trim().replace(/\s+/g, " ");
    if (!trimmed) return;

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      setError("Special characters are not allowed. Only letters, numbers, and spaces are permitted.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add product type");

      toast.success(`Product Type "${trimmed}" created successfully!`);
      setIsAddTypeModalOpen(false);
      setTypeName("");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;
    const trimmed = typeName.trim().replace(/\s+/g, " ");
    if (!trimmed) return;

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      setError("Special characters are not allowed. Only letters, numbers, and spaces are permitted.");
      return;
    }

    if (selectedType.name.trim() === trimmed) {
      toast.error("No changes made.");
      setIsEditTypeModalOpen(false);
      setSelectedType(null);
      setTypeName("");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${selectedType.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update product type");

      toast.success(`Product Type updated to "${trimmed}"!`);
      setIsEditTypeModalOpen(false);
      setSelectedType(null);
      setTypeName("");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteType = (type: ProductType) => {
    setConfirmMsg(`Are you sure you want to delete Product Type "${type.name}"?`);
    setConfirmAction(() => async () => {
      try {
        const res = await fetch(`/api/categories/${type.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete product type");

        toast.success(`Product Type "${type.name}" deleted!`);
        fetchData();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete");
      }
    });
    setConfirmOpen(true);
  };

  const openEditType = (type: ProductType) => {
    setSelectedType(type);
    setTypeName(type.name);
    setError(null);
    setIsEditTypeModalOpen(true);
  };

  // ─── PRODUCT CATEGORY HANDLERS ─────────────────────────────
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = catName.trim().replace(/\s+/g, " ");
    if (!trimmed) return;

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      setError("Special characters are not allowed. Only letters, numbers, and spaces are permitted.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/product-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add product category");

      toast.success(`Product Category "${trimmed}" created successfully!`);
      setIsAddCategoryModalOpen(false);
      setCatName("");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;
    const trimmed = catName.trim().replace(/\s+/g, " ");
    if (!trimmed) return;

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      setError("Special characters are not allowed. Only letters, numbers, and spaces are permitted.");
      return;
    }

    if (selectedCategory.name.trim() === trimmed) {
      toast.error("No changes made.");
      setIsEditCategoryModalOpen(false);
      setSelectedCategory(null);
      setCatName("");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/product-categories/${selectedCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update product category");

      toast.success(`Product Category updated to "${trimmed}"!`);
      setIsEditCategoryModalOpen(false);
      setSelectedCategory(null);
      setCatName("");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = (cat: ProductCategory) => {
    setConfirmMsg(`Are you sure you want to delete Product Category "${cat.name}"?`);
    setConfirmAction(() => async () => {
      try {
        const res = await fetch(`/api/product-categories/${cat.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete product category");

        toast.success(`Product Category "${cat.name}" deleted!`);
        fetchData();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete");
      }
    });
    setConfirmOpen(true);
  };

  const openEditCategory = (cat: ProductCategory) => {
    setSelectedCategory(cat);
    setCatName(cat.name);
    setError(null);
    setIsEditCategoryModalOpen(true);
  };

  if (sessionStatus === "loading") {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] flex items-center justify-center">
        <LoadingScreen message="Loading types and categories..." size="md" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100 space-y-6" suppressHydrationWarning>
      {/* ─── MODERN DESIGN TOP HEADER ──────────────────────────── */}
      <TopHeader
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onNotificationClick={handleNotificationClick}
      />

      {/* ─── NAVIGATION TABS & ACTIONS ROW ─────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-6">
          <Link
            href="/products"
            className="pb-3 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
          >
            All Products
          </Link>

          <button
            type="button"
            className="pb-3 text-sm font-semibold text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white font-bold transition relative cursor-pointer"
          >
            Product Types and Categories
          </button>
        </div>

        <div className="flex items-center gap-3 pb-3 sm:pb-0">
          {canManage && (
            <>
              <button
                onClick={() => {
                  setTypeName("");
                  setError(null);
                  setIsAddTypeModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#00A389] hover:bg-[#008f78] text-white rounded-lg text-xs font-semibold shadow-xs transition active:scale-98 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product Type</span>
              </button>

              <button
                onClick={() => {
                  setCatName("");
                  setError(null);
                  setIsAddCategoryModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#00A389] hover:bg-[#008f78] text-white rounded-lg text-xs font-semibold shadow-xs transition active:scale-98 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product Categories</span>
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16">
          <LoadingScreen message="Loading types and categories..." size="md" />
        </div>
      ) : (
        <div className="space-y-8 pt-1">
          {/* ─── SECTION 1: PRODUCT TYPES ──────────────────────────── */}
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Product Types</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
              Manage overarching product types (e.g. Ecom, Nutra) assigned across websites
            </p>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden mt-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-[#F8F9FA] dark:bg-slate-800/60">
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Product Type</th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-32">Sites</th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-36">Products</th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {productTypes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-400">
                          No product types found. Click &quot;Add Product Type&quot; above to create one.
                        </td>
                      </tr>
                    ) : (
                      productTypes.map((type) => (
                        <tr key={type.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{type.name}</span>
                          </td>
                          <td className="px-6 py-4 w-32">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{type._count?.sites || 0}</span>
                          </td>
                          <td className="px-6 py-4 w-36">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{type._count?.products || 0}</span>
                          </td>
                          <td className="px-6 py-4 w-28">
                            <div className="flex items-center gap-3">
                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditType(type)}
                                    className="text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition cursor-pointer p-0.5"
                                    title="Edit Product Type"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteType(type)}
                                    className="text-rose-400 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition cursor-pointer p-0.5"
                                    title="Delete Product Type"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ─── SECTION 2: PRODUCT CATEGORIES ─────────────────────── */}
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Product Categories</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
              Manage product niche categories (e.g. Skincare, Supplements, Fitness, Weight Loss) used across products
            </p>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden mt-3 max-w-[480px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-[#F8F9FA] dark:bg-slate-800/60">
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Product Categories</th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {productCategories.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-6 py-8 text-center text-xs text-slate-400">
                          No product categories found. Click &quot;Add Product Categories&quot; above to create one.
                        </td>
                      </tr>
                    ) : (
                      productCategories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{cat.name}</span>
                          </td>
                          <td className="px-6 py-4 w-28">
                            <div className="flex items-center gap-3">
                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditCategory(cat)}
                                    className="text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition cursor-pointer p-0.5"
                                    title="Edit Product Category"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(cat)}
                                    className="text-rose-400 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition cursor-pointer p-0.5"
                                    title="Delete Product Category"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD PRODUCT TYPE ───────────────────────────── */}
      {isAddTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Product Type</h3>
              <button
                type="button"
                onClick={() => setIsAddTypeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddType} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Product Type Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ecom, Nutra, Supplement"
                  value={typeName}
                  onChange={(e) => {
                    setTypeName(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00A389] focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTypeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !typeName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#00A389] hover:bg-[#008f78] text-white disabled:opacity-50 transition cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Adding..." : "Add Product Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT PRODUCT TYPE ──────────────────────────── */}
      {isEditTypeModalOpen && selectedType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Product Type</h3>
              <button
                type="button"
                onClick={() => setIsEditTypeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateType} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Product Type Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={typeName}
                  onChange={(e) => {
                    setTypeName(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00A389] focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditTypeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !typeName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#00A389] hover:bg-[#008f78] text-white disabled:opacity-50 transition cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD PRODUCT CATEGORY ───────────────────────── */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Product Category</h3>
              <button
                type="button"
                onClick={() => setIsAddCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fitness, Skin Care, Tech"
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00A389] focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !catName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#00A389] hover:bg-[#008f78] text-white disabled:opacity-50 transition cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Adding..." : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT PRODUCT CATEGORY ──────────────────────── */}
      {isEditCategoryModalOpen && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Product Category</h3>
              <button
                type="button"
                onClick={() => setIsEditCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateCategory} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00A389] focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !catName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#00A389] hover:bg-[#008f78] text-white disabled:opacity-50 transition cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRM DIALOG ────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Confirm Action"
        message={confirmMsg}
        onConfirm={() => {
          if (confirmAction) confirmAction();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
