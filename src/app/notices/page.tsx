// src/app/notices/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Megaphone } from "lucide-react";

interface Notice {
  id: number;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  createdBy: { id: number; name: string; role: string; image?: string };
  isRead: boolean;
  readAt: string | null;
  totalAcknowledgments: number;
}

export default function NoticeBoard() {
  const { data: session, status } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [error, setError] = useState<string | null>(null);

  const fetchNotices = async () => {
    try {
      const res = await fetch("/api/notices");
      if (!res.ok) throw new Error("Failed to fetch notices");
      const data = await res.json();
      setNotices(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchNotices();
  }, [status]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, category }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Create failed");
      }
      setTitle("");
      setContent("");
      setCategory("GENERAL");
      await fetchNotices();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (status === "loading") return <p>Loading session…</p>;
  if (!session) return <p>You must be signed in to view notices.</p>;

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Megaphone size={24} /> Notice Board
      </h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {isAdmin && (
        <form onSubmit={handleCreate} className="mb-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-3">Create New Notice</h2>
          <div className="grid gap-3">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="p-2 border rounded"
              required
            />
            <textarea
              placeholder="Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="p-2 border rounded h-32"
              required
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="IMPORTANT">IMPORTANT</option>
              <option value="GENERAL">GENERAL</option>
              <option value="SUGGESTION">SUGGESTION</option>
              <option value="URGENT">URGENT</option>
              <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
            </select>
            <button
              type="submit"
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Publish
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading notices…</p>
      ) : (
        <ul className="space-y-4">
          {notices.map((n) => (
            <li key={n.id} className="p-4 border rounded bg-white dark:bg-gray-900">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium">{n.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{n.content}</p>
                  <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                    {new Date(n.createdAt).toLocaleString()} • {n.createdBy.name} ({n.createdBy.role})
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded ${n.isRead ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                >
                  {n.isRead ? "Read" : "Unread"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
