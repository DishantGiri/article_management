"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Megaphone, X, AlertTriangle, Info, Sparkles, Bell, CheckCircle } from "lucide-react";

interface PendingNotice {
  id: number;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  createdBy: { id: number; name: string; role: string };
}

const CATEGORY_STYLES: Record<string, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
  URGENT: {
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-300 dark:border-red-700",
    icon: <AlertTriangle className="text-red-500" size={20} />,
    label: "Urgent",
  },
  IMPORTANT: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-700",
    icon: <Bell className="text-amber-500" size={20} />,
    label: "Important",
  },
  ANNOUNCEMENT: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-300 dark:border-blue-700",
    icon: <Megaphone className="text-blue-500" size={20} />,
    label: "Announcement",
  },
  SUGGESTION: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-300 dark:border-purple-700",
    icon: <Sparkles className="text-purple-500" size={20} />,
    label: "Suggestion",
  },
  GENERAL: {
    bg: "bg-slate-50 dark:bg-slate-900/60",
    border: "border-slate-300 dark:border-slate-700",
    icon: <Info className="text-slate-500" size={20} />,
    label: "General",
  },
};

export default function NoticePopupModal() {
  const { data: session, status } = useSession();
  const [queue, setQueue] = useState<PendingNotice[]>([]);
  const [currentNotice, setCurrentNotice] = useState<PendingNotice | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [visible, setVisible] = useState(false);

  // Fetch pending (unacknowledged) notices on mount
  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchPending = async () => {
      try {
        const res = await fetch("/api/notices/pending");
        if (!res.ok) return;
        const data: PendingNotice[] = await res.json();
        if (data.length > 0) {
          setQueue(data);
        }
      } catch (e) {
        console.error("Failed to fetch pending notices:", e);
      }
    };

    fetchPending();
  }, [status]);

  // Listen for real-time NOTICE_PUBLISHED WebSocket events
  useEffect(() => {
    const handleWsNotice = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && detail.type === "NOTICE_PUBLISHED" && detail.data) {
        const notice: PendingNotice = {
          id: detail.data.id,
          title: detail.data.title,
          content: detail.data.content,
          category: detail.data.category,
          createdAt: detail.data.createdAt,
          createdBy: detail.data.createdBy,
        };
        setQueue((prev) => {
          // Avoid duplicate
          if (prev.some((n) => n.id === notice.id)) return prev;
          return [notice, ...prev];
        });
      }
    };

    window.addEventListener("notice-published", handleWsNotice);
    return () => window.removeEventListener("notice-published", handleWsNotice);
  }, []);

  // Show next notice from queue
  useEffect(() => {
    if (!currentNotice && queue.length > 0) {
      setCurrentNotice(queue[0]);
      setVisible(true);
    }
  }, [queue, currentNotice]);

  const handleAcknowledge = useCallback(async () => {
    if (!currentNotice || acknowledging) return;
    setAcknowledging(true);
    try {
      await fetch(`/api/notices/${currentNotice.id}/ack`, {
        method: "POST",
      });
    } catch (e) {
      console.error("Failed to acknowledge notice:", e);
    }
    setAcknowledging(false);
    setVisible(false);
    // Wait for fade-out animation, then move to next
    setTimeout(() => {
      setQueue((prev) => prev.filter((n) => n.id !== currentNotice.id));
      setCurrentNotice(null);
    }, 300);
  }, [currentNotice, acknowledging]);

  if (!visible || !currentNotice) return null;

  const style = CATEGORY_STYLES[currentNotice.category] || CATEGORY_STYLES.GENERAL;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        style={{ animation: "fadeIn 0.3s ease-out" }}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl border-2 ${style.border} ${style.bg} overflow-hidden`}
        style={{ animation: "slideUp 0.35s ease-out" }}
      >
        {/* Category Header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-inherit">
          <div className="flex items-center gap-2 flex-1">
            {style.icon}
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {style.label} Notice
            </span>
          </div>
          {queue.length > 1 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {queue.length} pending
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            {currentNotice.title}
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {currentNotice.content}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span>
              Posted by <strong>{currentNotice.createdBy.name}</strong>
            </span>
            <span>•</span>
            <span>{new Date(currentNotice.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Action */}
        <div className="px-6 py-4 border-t border-inherit flex justify-end">
          <button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
              bg-emerald-600 hover:bg-emerald-700 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 shadow-lg hover:shadow-xl
              active:scale-95"
          >
            <CheckCircle size={16} />
            {acknowledging ? "Saving…" : "I have understood"}
          </button>
        </div>
      </div>

      {/* Inline animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
