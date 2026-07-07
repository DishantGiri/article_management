import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "ArticleMgmt — Workflow System",
  description: "Product & article workflow management for Linkers, Writers, and Team Leads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`} suppressHydrationWarning>
      <body className="h-full bg-slate-50 antialiased" suppressHydrationWarning>
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 ml-64 min-h-screen overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
