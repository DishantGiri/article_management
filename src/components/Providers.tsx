"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import NoticePopupModal from "@/components/NoticePopupModal";

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.log('Service Worker registration failed:', err));
    }

    // Shield against third-party Chrome extension errors
    const handleRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const stack = (reason && reason.stack) || "";
      const msg = (reason && reason.message) || String(reason || "");
      if (
        stack.includes("chrome-extension://") ||
        stack.includes("moz-extension://") ||
        msg.includes("M_ID")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const handleError = (e: ErrorEvent) => {
      const filename = e.filename || "";
      const stack = (e.error && e.error.stack) || "";
      const msg = e.message || "";
      if (
        filename.includes("chrome-extension://") ||
        filename.includes("moz-extension://") ||
        stack.includes("chrome-extension://") ||
        msg.includes("M_ID")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener("unhandledrejection", handleRejection, true);
    window.addEventListener("error", handleError, true);

    return () => {
      window.removeEventListener("unhandledrejection", handleRejection, true);
      window.removeEventListener("error", handleError, true);
    };
  }, []);

  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <ThemeProvider>
        {children}
        <NoticePopupModal />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--card, #ffffff)',
              color: 'var(--foreground, #4A4A4A)',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '16px',
              border: '1px solid var(--border, rgba(203, 203, 203, 0.8))',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
