"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Trash2, CheckCircle2, Package, AlertTriangle, Eye, FileText, Star } from "lucide-react";

interface Notification {
  id: number;
  recipientId: number;
  senderId: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    name: string;
  };
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number>(1);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mockUserId") || "1" : "1";
    setCurrentUserId(parseInt(stored));
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?userId=${currentUserId}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentUserId]);

  const markAllAsRead = async () => {
    if (marking) return;
    setMarking(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        );
      }
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount} unread
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={marking}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            {marking ? "Marking..." : "Mark all read"}
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div suppressHydrationWarning>
        {loading ? (
          <div className="p-12 text-center" suppressHydrationWarning>
            <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" suppressHydrationWarning></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-sm" suppressHydrationWarning>
            No notifications yet.
          </div>
        ) : (
          <div className="space-y-3" suppressHydrationWarning>
            {notifications.map((notification) => {
              
              // Determine icon and colors based on notification type/message
              let Icon = Bell;
              let iconBg = "bg-slate-50 text-slate-500";
              
              const msg = notification.message.toLowerCase();
              if (msg.includes("product") || notification.type === "PRODUCT_ADDED") {
                Icon = Package;
                iconBg = "bg-indigo-50 text-indigo-500";
              } else if (msg.includes("approved")) {
                Icon = CheckCircle2;
                iconBg = "bg-emerald-50 text-emerald-500";
              } else if (msg.includes("dead link") || msg.includes("issue")) {
                Icon = AlertTriangle;
                iconBg = "bg-rose-50 text-rose-500";
              } else if (msg.includes("review")) {
                Icon = Eye;
                iconBg = "bg-cyan-50 text-cyan-500";
              } else if (msg.includes("completed")) {
                Icon = FileText;
                iconBg = "bg-emerald-50 text-emerald-500";
              } else if (msg.includes("special")) {
                Icon = Star;
                iconBg = "bg-purple-50 text-purple-500";
              }

              // Format date nicely (e.g., "1h ago", or short date)
              const timeLabel = new Date(notification.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={notification.id}
                  className="bg-white border border-slate-200/60 rounded-xl p-4 flex items-center gap-4 hover:border-indigo-200 hover:shadow-sm transition-all"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {notification.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Please review the details and take necessary action.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-xs text-slate-400 font-medium">
                      {timeLabel}
                    </span>
                    <div className="w-2.5 h-2.5 flex items-center justify-center">
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
