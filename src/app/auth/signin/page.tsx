/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { signIn, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import {
  ShieldCheck,
  Zap,
  Package,
  Clock,
  Link as LinkIcon,
  CheckCircle2,
  Users,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const DEMO_USERS = [
  { name: "Admin (Shiridhar)", role: "ADMIN", email: "shiridhar@fishtailinfosolutions.com", color: "bg-slate-100 text-slate-800 border-slate-300" },
  { name: "Team Lead (Sujata)", role: "TEAM_LEAD", email: "sujata@fishtailinfosolutions.com", color: "bg-violet-50 text-violet-700 border-violet-200" },
  { name: "Linker (Anjali)", role: "LINKER", email: "anjali@fishtailinfosolutions.com", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "Writer (Nirajan)", role: "WRITER", email: "nirajan@fishtailinfosolutions.com", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (email: string) => {
    if (!email) return;
    setLoading(true);
    try {
      await signIn("credentials", { email, callbackUrl });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const error = searchParams.get("error");

  return (
    <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-[#CBCBCB]/70 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px] animate-scaleIn">
      {/* LEFT SHOWCASE PANE */}
      <div className="lg:col-span-7 bg-[#FAF9F5] p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-[#CBCBCB]/60 flex flex-col justify-between space-y-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#6D8196] text-white flex items-center justify-center font-extrabold text-lg shadow-xs">
              A
            </div>
            <div>
              <span className="font-extrabold text-base text-slate-900 tracking-tight block">ArticleFlow</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Enterprise Workspace</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6D8196]/10 text-[#3D4F61] border border-[#6D8196]/25 text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#6D8196]" />
              Workflow Orchestration Platform
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Scale content production with precision workflows.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
              Designed specifically for multi-site publishing, automated affiliate linking, and real-time writing tracking.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-white rounded-2xl border border-[#CBCBCB]/50 shadow-2xs space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-slate-800">Nutra & Ecom Catalog</p>
              <p className="text-[11px] text-slate-500 font-medium leading-snug">
                One-click product indexing across all authorized domain categories.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#CBCBCB]/50 shadow-2xs space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-slate-800">Writing Precision Timers</p>
              <p className="text-[11px] text-slate-500 font-medium leading-snug">
                Stopwatch tracking for initial drafts and revision rounds.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#CBCBCB]/50 shadow-2xs space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <LinkIcon className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-slate-800">Multi-Geo Affiliate Gateway</p>
              <p className="text-[11px] text-slate-500 font-medium leading-snug">
                Multi-country tag assignment with automated link health alerts.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#CBCBCB]/50 shadow-2xs space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-slate-800">Team Lead Review Dispatch</p>
              <p className="text-[11px] text-slate-500 font-medium leading-snug">
                Fast approval queues and direct writer feedback loop.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium pt-4">
          <ShieldCheck className="w-3.5 h-3.5 text-[#6D8196]" />
          <span>Enterprise Grade Access Control & Role Partitioning</span>
        </div>
      </div>

      {/* RIGHT SIGN IN PANE */}
      <div className="lg:col-span-5 p-8 lg:p-12 flex flex-col justify-between space-y-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Sign in to Workspace</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Use your corporate account or quick-access demo credentials.</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              <p className="font-bold">Access Denied</p>
              <p className="text-[11px] text-rose-600 mt-0.5">Please sign in with your authorized corporate email.</p>
            </div>
          )}

          {/* Email Login Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEmailSignIn(emailInput);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Corporate Email / Username
              </label>
              <input
                type="text"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                placeholder="name@fishtailinfosolutions.com"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6D8196] placeholder:text-slate-400 font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !emailInput.trim()}
              className="w-full py-2.5 px-4 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Continue with Email"
              )}
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-3 text-slate-400 text-[10px] font-bold uppercase tracking-wider">Or</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl font-bold text-xs shadow-2xs transition flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>Google Workspace SSO</span>
          </button>
        </div>

        {/* 1-Click Role Quick Access (For Exploration & Testing) */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Role Test Access</p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_USERS.map((u) => (
              <button
                key={u.role}
                type="button"
                onClick={() => handleEmailSignIn(u.email)}
                disabled={loading}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition flex items-center gap-1 cursor-pointer hover:shadow-2xs ${u.color}`}
              >
                <span>{u.name}</span>
                <ArrowRight className="w-2.5 h-2.5 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#6D8196] rounded-full animate-spin mx-auto" />
          </div>
        }
      >
        <SignInContent />
      </Suspense>
    </div>
  );
}
