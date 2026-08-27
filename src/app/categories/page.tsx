/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Category {
  id: number;
  name: string;
  _count: { sites: number, products: number };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Form states
  const [categoryName, setCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  const fetchCategories = () => {
    setLoading(true);
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add category");

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
    if (!selectedCategory || !categoryName) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update category");

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
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete category");
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

  const openAddModal = () => {
    setError(null);
    setCategoryName("");
    setIsAddModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setError(null);
    setSelectedCategory(category);
    setCategoryName(category.name);
    setIsEditModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A] tracking-tight">Web Categories</h1>
          <p className="text-[#737373] text-sm mt-0.5 font-medium">Manage categories that can be assigned across multiple sites</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-5 py-2.5 bg-[#6D8196] text-white rounded-xl text-sm font-semibold hover:bg-[#5A6D81] shadow-xs transition flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#CBCBCB] border-t-[#6D8196] rounded-full animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 p-16 text-center shadow-xs">
          <p className="text-[#737373] font-medium">No categories found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs overflow-hidden p-6">
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => openEditModal(cat)}
                className="group flex flex-col items-start px-4 py-3 rounded-xl bg-[#FAF9F5] border border-[#CBCBCB] hover:bg-white hover:border-[#6D8196] hover:shadow-sm transition-all text-left w-[200px] cursor-pointer"
              >
                <span className="text-[14px] font-bold text-[#4A4A4A] group-hover:text-[#6D8196] transition-colors">{cat.name}</span>
                <div className="mt-2 flex gap-3 text-[11px] font-medium text-[#737373]">
                  <span>{cat._count?.sites || 0} sites</span>
                  <span>{cat._count?.products || 0} products</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="flex items-center justify-between p-5 bg-[#4A4A4A] text-white">
              <h2 className="text-base font-bold text-white">Add Web Category</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="p-5 bg-white space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-lg">{error}</div>}
              
              <div>
                <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider mb-1.5">Category Name</label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Weight Loss"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#CBCBCB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#4A4A4A] border border-[#CBCBCB] hover:bg-[#FAF9F5] rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#6D8196] hover:bg-[#5A6D81] rounded-xl transition disabled:opacity-50 cursor-pointer shadow-xs"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="flex items-center justify-between p-5 bg-[#4A4A4A] text-white">
              <h2 className="text-base font-bold text-white">Edit Category</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateCategory} className="p-5 bg-white space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-lg">{error}</div>}
              
              <div>
                <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider mb-1.5">Category Name</label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#CBCBCB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D8196]/20 focus:border-[#6D8196]"
                />
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleDeleteCategory}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-[#4A4A4A] border border-[#CBCBCB] hover:bg-[#FAF9F5] rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
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
        title="Delete Category"
        message={`Are you sure you want to delete "${selectedCategory?.name}"? This cannot be undone.`}
        confirmLabel="Delete Category"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); doDelete(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
