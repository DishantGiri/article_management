"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ArchedNotificationCard } from "./ArchedNotificationCard";
import { isUserTargeted } from "@/lib/noticeUtils";

interface PendingNotice {
  id: number;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  createdBy: { id: number; name: string; role: string };
}

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
        const targetRolesRaw = detail.data.targetRoles || detail.data.targetRole || "ALL";
        const userRole = session?.user?.role;

        // Strictly check if this notice targets current user's role
        if (!isUserTargeted(targetRolesRaw, userRole)) {
          return;
        }

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
  }, [session?.user?.role]);

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
      // Notify notices page to update if open
      window.dispatchEvent(new CustomEvent("notice-acknowledged", { detail: { noticeId: currentNotice.id } }));
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Soft Blurred Ambient Backdrop (Non-dismissable to enforce acknowledgment) */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn pointer-events-auto" />

      {/* Arched Notification Modal Card */}
      <div className="relative z-10 animate-bouncePop max-w-sm sm:max-w-md w-full my-auto flex justify-center">
        <ArchedNotificationCard
          category={currentNotice.category}
          count={queue.length}
          title={currentNotice.title}
          message={currentNotice.content}
          authorName={currentNotice.createdBy?.name}
          createdAt={currentNotice.createdAt}
          actionLabel="I have understood"
          isAcknowledging={acknowledging}
          onAction={handleAcknowledge}
          showCloseButton={false}
          isModal={true}
        />
      </div>
    </div>
  );
}
