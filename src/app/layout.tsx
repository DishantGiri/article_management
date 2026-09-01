import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Providers from "@/components/Providers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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

export const viewport = {
  themeColor: "#4f46e5",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const showSidebar = session && session.user.approved !== false;

  return (
    <html lang="en" className={`${inter.variable} font-sans h-full`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('theme') || 'system';
                var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="h-full bg-[#FAF9F5] text-[#4A4A4A] dark:bg-[#0f172a] dark:text-[#f1f5f9] antialiased" suppressHydrationWarning>
        <Providers>
          <div className="flex h-full" suppressHydrationWarning>
            {showSidebar && <Sidebar />}
            <main className={`flex-1 min-h-screen overflow-y-auto ${showSidebar ? "pt-[57px] lg:pt-0 ml-0 lg:ml-64" : ""}`} suppressHydrationWarning>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
