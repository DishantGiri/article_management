"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  Package,
  AlertTriangle,
  Eye,
  FileText,
  Star,
  ChevronDown,
  Calendar,
  Sparkles,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [filterType, setFilterType] = useState<"ALL" | "UNREAD">("ALL");

  const currentUserId = session?.user?.id ? Number(session.user.id) : null;

  const fetchNotifications = async () => {
    if (!currentUserId) return;
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
    if (currentUserId) {
      fetchNotifications();
    }
  }, [currentUserId]);

  const markAllAsRead = async () => {
    if (!currentUserId || marking) return;
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
        window.dispatchEvent(new CustomEvent("notifications-marked-read"));
      }
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    } finally {
      setMarking(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // 1. Mark as read in DB if it's currently unread
    if (!notification.isRead) {
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        });
        if (res.ok) {
          // Update local state
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
          );
          // Tell Sidebar to refetch
          window.dispatchEvent(new CustomEvent("notifications-updated"));
        }
      } catch (err) {
        console.error("Failed to mark single notification as read:", err);
      }
    }

    // 2. Redirect based on notification type and message content
    const msg = notification.message;
    const match = msg.match(/"([^"]+)"/);
    const productName = match ? match[1] : null;

    if (msg.toLowerCase().includes("changes requested") || msg.toLowerCase().includes("redo") || msg.toLowerCase().includes("wrong")) {
      router.push("/?tab=write");
      return;
    }

    const userRole = session?.user?.role || "WRITER";

    if (productName) {
      const searchParam = encodeURIComponent(productName);
      if (notification.type === "LINK_ISSUE" || msg.toLowerCase().includes("link")) {
        router.push(`/links?search=${searchParam}`);
      } else {
        router.push(`/articles?search=${searchParam}`);
      }
    } else {
      if (userRole === "LINKER") {
        router.push("/links");
      } else {
        router.push("/articles");
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = useMemo(() => {
    if (filterType === "UNREAD") {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filterType]);

  const displayedNotifications = useMemo(() => {
    return filteredNotifications.slice(0, visibleCount);
  }, [filteredNotifications, visibleCount]);

  const hasMore = visibleCount < filteredNotifications.length;

  const handleSeeMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A] space-y-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <h1 className="text-2xl font-bold text-[#4A4A4A] tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#6D8196]" />
            Notifications
          </h1>
          <p className="text-xs text-[#737373] mt-1 font-medium flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#6D8196]" />
            Past 1 Month Activity &bull; {unreadCount} unread
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Tabs */}
          <div className="flex bg-white rounded-xl p-1 border border-[#CBCBCB]/60 shadow-2xs">
            <button
              onClick={() => { setFilterType("ALL"); setVisibleCount(10); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === "ALL"
                  ? "bg-[#6D8196] text-white shadow-2xs"
                  : "text-[#737373] hover:text-[#4A4A4A]"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => { setFilterType("UNREAD"); setVisibleCount(10); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === "UNREAD"
                  ? "bg-[#6D8196] text-white shadow-2xs"
                  : "text-[#737373] hover:text-[#4A4A4A]"
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterType === "UNREAD" ? "bg-white text-[#6D8196]" : "bg-[#6D8196]/15 text-[#3D4F61]"}`}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={marking}
              className="px-3.5 py-2 rounded-xl bg-white border border-[#CBCBCB] hover:border-[#6D8196] text-xs font-bold text-[#6D8196] hover:text-[#4A4A4A] transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {marking ? "Marking..." : "Mark all read"}
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div suppressHydrationWarning>
        {loading ? (
          <div className="p-16 text-center" suppressHydrationWarning>
            <div className="w-8 h-8 border-4 border-[#CBCBCB] border-t-[#6D8196] rounded-full animate-spin mx-auto mb-4" suppressHydrationWarning></div>
            <p className="text-xs text-[#737373] font-medium">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-[#CBCBCB]/60 shadow-xs" suppressHydrationWarning>
            <div className="w-12 h-12 rounded-2xl bg-[#6D8196]/15 text-[#3D4F61] flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#4A4A4A]">No Notifications</h3>
            <p className="text-xs text-[#737373] mt-1 font-medium">
              {filterType === "UNREAD" ? "You have no unread notifications." : "No notifications in the past month."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5" suppressHydrationWarning>
            {displayedNotifications.map((notification) => {
              // Determine icon and colors based on notification type/message
              let Icon = Bell;
              let iconBg = "bg-[#6D8196]/15 text-[#3D4F61] border border-[#6D8196]/30";

              const msg = notification.message.toLowerCase();
              if (msg.includes("changes requested") || msg.includes("redo") || msg.includes("wrong") || msg.includes("needs changes")) {
                Icon = AlertTriangle;
                iconBg = "bg-rose-50 text-rose-700 border border-rose-200/60";
              } else if (msg.includes("product") || notification.type === "PRODUCT_ADDED") {
                Icon = Package;
                iconBg = "bg-[#6D8196]/15 text-[#3D4F61] border border-[#6D8196]/30";
              } else if (msg.includes("approved")) {
                Icon = CheckCircle2;
                iconBg = "bg-emerald-50 text-emerald-700 border border-emerald-200/60";
              } else if (msg.includes("dead link") || msg.includes("issue")) {
                Icon = AlertTriangle;
                iconBg = "bg-rose-50 text-rose-700 border border-rose-200/60";
              } else if (msg.includes("review")) {
                Icon = Eye;
                iconBg = "bg-cyan-50 text-cyan-700 border border-cyan-200/60";
              } else if (msg.includes("completed")) {
                Icon = FileText;
                iconBg = "bg-emerald-50 text-emerald-700 border border-emerald-200/60";
              } else if (msg.includes("special")) {
                Icon = Star;
                iconBg = "bg-amber-50 text-amber-700 border border-amber-200/60";
              }

              // Format date nicely
              const timeLabel = new Date(notification.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`bg-white border rounded-2xl p-4 flex items-center gap-4 transition-all cursor-pointer shadow-2xs hover:shadow-sm ${
                    !notification.isRead
                      ? "border-[#6D8196]/50 hover:border-[#6D8196] bg-white"
                      : "border-[#CBCBCB]/60 hover:border-[#6D8196]/60 hover:bg-[#FAF9F5]"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs ${iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className={`text-sm leading-snug truncate ${!notification.isRead ? "font-bold text-[#4A4A4A]" : "font-medium text-slate-600"}`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-[#737373] mt-0.5">
                      Click to view associated product and details.
                    </p>
                  </div>

                  <div className="flex items-center gap-3.5 flex-shrink-0">
                    <span className="text-xs text-[#737373] font-medium">
                      {timeLabel}
                    </span>
                    <div className="w-2.5 h-2.5 flex items-center justify-center">
                      {!notification.isRead && (
                        <div className="w-2.5 h-2.5 bg-[#6D8196] rounded-full shadow-xs animate-pulse"></div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* See More Controls */}
            {hasMore && (
              <div className="pt-4 flex flex-col items-center justify-center gap-2">
                <button
                  onClick={handleSeeMore}
                  className="px-6 py-2.5 bg-white border border-[#CBCBCB] hover:border-[#6D8196] hover:bg-[#FAF9F5] text-[#4A4A4A] hover:text-[#6D8196] rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <span>See More</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#6D8196]/15 text-[#3D4F61] text-[10px] font-bold">
                    +{Math.min(10, filteredNotifications.length - visibleCount)} more
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <p className="text-[11px] text-[#737373] font-medium">
                  Showing {displayedNotifications.length} of {filteredNotifications.length} notifications (Past 30 days)
                </p>
              </div>
            )}

            {!hasMore && filteredNotifications.length > 10 && (
              <div className="pt-4 text-center">
                <p className="text-[11px] text-[#737373] font-medium">
                  All {filteredNotifications.length} notifications from the past month are displayed.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

