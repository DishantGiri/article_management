import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Providers from "@/components/Providers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport = {
  themeColor: "#4f46e5",
};

export const metadata: Metadata = {
  title: "ArticleMgmt — Workflow System",
  description: "Product & article workflow management for Linkers, Writers, and Team Leads.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ArticleMgmt",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const showSidebar = session && session.user.approved !== false;

  return (
    <html lang="en" className={`${inter.variable} font-sans h-full`} suppressHydrationWarning>
      <body className="h-full bg-slate-50 antialiased" suppressHydrationWarning>
        <Providers>
          <div className="flex h-full" suppressHydrationWarning>
            {showSidebar && <Sidebar />}
            <main className={`flex-1 min-h-screen overflow-y-auto ${showSidebar ? "ml-64" : ""}`} suppressHydrationWarning>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
