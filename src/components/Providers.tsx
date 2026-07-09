"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.log('Service Worker registration failed:', err));
    }
  }, []);

  return (
    <SessionProvider>
      {children}
      <Toaster position="bottom-right" toastOptions={{ duration: 4000, style: { background: '#1e293b', color: '#fff', fontSize: '13px', fontWeight: 600, borderRadius: '12px' } }} />
    </SessionProvider>
  );
}
