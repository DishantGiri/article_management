"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Product {
  id: number;
  name: string;
  productType: "NUTRA" | "ECOM";
  trendLink?: string;
  previewLink?: string;
  remarks?: string;
  addedAt: string;
  site: { name: string };
  category: { name: string };
  addedBy: { name: string };
  article?: { id: number; status: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

const TYPE_COLORS: Record<string, string> = {
  NUTRA: "bg-emerald-100 text-emerald-700",
  ECOM: "bg-blue-100 text-blue-700",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.site.name.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || p.productType === typeFilter;
    const matchStatus = !statusFilter || p.article?.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-1">{products.length} products across all sites</p>
        </div>
        <Link href="/products/add"
          className="px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Product
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search products or sites…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white flex-1 min-w-48"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <option value="">All Types</option>
          <option value="NUTRA">NUTRA</option>
          <option value="ECOM">ECOM</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">No products found</p>
          <Link href="/products/add" className="mt-3 inline-block text-violet-600 text-sm hover:underline">Add your first product →</Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3.5">Product</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Type</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Site / Category</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Added By</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Article</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs flex-shrink-0">
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        {p.remarks && <p className="text-xs text-gray-400 truncate max-w-32">{p.remarks}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[p.productType]}`}>{p.productType}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-gray-700">{p.site.name}</p>
                    <p className="text-xs text-gray-400">{p.category.name}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{p.addedBy.name}</td>
                  <td className="px-4 py-3.5">
                    {p.article ? (
                      <Link href={`/articles/${p.article.id}`}>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[p.article.status]}`}>
                          {p.article.status.replace("_", " ")}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">
                    {new Date(p.addedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      {p.trendLink && (
                        <a href={p.trendLink} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline" title="Trend Link">Trend</a>
                      )}
                      {p.previewLink && (
                        <a href={p.previewLink} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-violet-500 hover:underline" title="Preview Link">Preview</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
