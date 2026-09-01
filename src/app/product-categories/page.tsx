/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Plus, X, Trash2, Tag, ShieldAlert, AlertCircle, Sparkles } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingScreen from "@/components/LoadingScreen";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";

interface ProductCategory {
  id: number;
  name: string;
  createdAt: string;
}

export default function ProductCategoriesPage() {
  const { data: session } = useSession();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);

  // Form states
  const [categoryName, setCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);

  const userRole = session?.user?.role;
  const canManage =
    userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "LINKER";

  const fetchCategories = () => {
    setLoading(true);
    fetch("/api/product-categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Failed to load product categories", err);
        toast.error("Failed to load product categories");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/product-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add product category");

      toast.success(`Category "${categoryName.trim()}" created successfully!`);
      setIsAddModalOpen(false);
      setCategoryName("");
      fetchCategories();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !categoryName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/product-categories/${selectedCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update category");

      toast.success(`Category updated to "${categoryName.trim()}"!`);
      setIsEditModalOpen(false);
      setSelectedCategory(null);
      setCategoryName("");
      fetchCategories();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!selectedCategory) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/product-categories/${selectedCategory.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete category");
      toast.success(`Category "${selectedCategory.name}" deleted.`);
      setIsEditModalOpen(false);
      setSelectedCategory(null);
      setCategoryName("");
      fetchCategories();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setError(null);
    setCategoryName("");
    setIsAddModalOpen(true);
  };

  const openEditModal = (category: ProductCategory) => {
    setError(null);
    setSelectedCategory(category);
    setCategoryName(category.name);
    setIsEditModalOpen(true);
  };

  if (!canManage && session) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-6 text-center shadow-sm">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Product categories can only be managed by Super Admin, Admin, and Linker roles.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A] dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Tag className="w-6 h-6 text-[#6D8196]" />
            Product Categories
          </h1>
          <p className="text-[#737373] dark:text-slate-400 text-sm mt-0.5 font-medium">
            Manage product niche categories (e.g. Skincare, Supplements, Fitness, Weight Loss) used across products
          </p>
        </div>
        {canManage && (
          <button
            onClick={openAddModal}
            className="px-5 py-2.5 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-xl text-sm font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Product Category
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16">
          <LoadingScreen
            message="Loading product categories..."
            subtext="Retrieving category classifications"
            size="md"
          />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 p-16 text-center shadow-xs">
          <Tag className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-[#737373] dark:text-slate-400 font-medium">No product categories found.</p>
          {canManage && (
            <button
              onClick={openAddModal}
              className="mt-4 px-4 py-2 bg-[#6D8196] text-white text-xs font-bold rounded-xl hover:bg-[#5A6D81] transition cursor-pointer"
            >
              Create First Category
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#CBCBCB]/60 dark:border-slate-800 shadow-xs overflow-hidden p-6">
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => openEditModal(cat)}
                className="group flex items-center justify-between px-4 py-3 rounded-xl bg-[#FAF9F5] dark:bg-slate-800/70 border border-[#CBCBCB] dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:border-[#6D8196] hover:shadow-sm transition-all text-left min-w-[200px] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#6D8196]/15 dark:bg-[#6D8196]/30 flex items-center justify-center text-[#6D8196] dark:text-sky-300 shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[13px] font-bold text-[#4A4A4A] dark:text-slate-200 group-hover:text-[#6D8196] dark:group-hover:text-sky-300 transition-colors">
                    {cat.name}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-[#6D8196] transition-colors ml-2">
                  Edit
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between p-5 bg-[#4A4A4A] dark:bg-slate-800 text-white">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#6D8196]" />
                Add Product Category
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="p-5 bg-white dark:bg-slate-900 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-red-600 dark:text-rose-300 text-xs font-semibold rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#4A4A4A] dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Weight Loss, Skincare, Supplements, Fitness"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-[#CBCBCB] dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#4A4A4A] dark:text-slate-300 border border-[#CBCBCB] dark:border-slate-700 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !categoryName.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#6D8196] hover:bg-[#5A6D81] rounded-xl transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Adding..." : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between p-5 bg-[#4A4A4A] dark:bg-slate-800 text-white">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#6D8196]" />
                Edit Product Category
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateCategory} className="p-5 bg-white dark:bg-slate-900 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-red-600 dark:text-rose-300 text-xs font-semibold rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#4A4A4A] dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-[#CBCBCB] dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
                />
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleDeleteCategory}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-[#4A4A4A] dark:text-slate-300 border border-[#CBCBCB] dark:border-slate-700 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !categoryName.trim()}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#6D8196] hover:bg-[#5A6D81] rounded-xl transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Product Category"
        message={`Are you sure you want to delete "${selectedCategory?.name}"? This cannot be undone.`}
        confirmLabel="Delete Category"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); doDelete(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
