"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  LayoutDashboard,
  Coins,
} from "lucide-react";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";

interface CommissionPasswordGateProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export default function CommissionPasswordGate({
  children,
  pageTitle = "Commissions",
}: CommissionPasswordGateProps) {
  const [checking, setChecking] = useState(true);
  const [isProtected, setIsProtected] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Password input form
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const checkStatus = useCallback(async () => {
    try {
      setChecking(true);
      const res = await fetch("/api/settings/commission-password");
      if (!res.ok) {
        // If error fetching, fallback to open or show error
        setIsProtected(false);
        setIsUnlocked(true);
        return;
      }

      const data = await res.json();
      if (!data.isSet || !data.enabled) {
        setIsProtected(false);
        setIsUnlocked(true);
      } else {
        setIsProtected(true);
        const alreadyUnlocked = sessionStorage.getItem("commission_access_unlocked") === "true";
        setIsUnlocked(alreadyUnlocked);
      }
    } catch (err) {
      console.error("[CommissionPasswordGate] Check error:", err);
      // Fallback
      setIsProtected(false);
      setIsUnlocked(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (!checking && isProtected && !isUnlocked) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [checking, isProtected, isUnlocked]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage("Please enter the commission password");
      return;
    }

    try {
      setVerifying(true);
      setErrorMessage(null);

      const res = await fetch("/api/settings/commission-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        setErrorMessage(data.error || "Incorrect commission password. Please try again.");
        return;
      }

      // Success
      sessionStorage.setItem("commission_access_unlocked", "true");
      setIsUnlocked(true);
      toast.success("Commission access unlocked!");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to verify password. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleRelock = () => {
    sessionStorage.removeItem("commission_access_unlocked");
    setIsUnlocked(false);
    setPassword("");
    setErrorMessage(null);
    toast.success("Page locked!");
  };

  // 1. Loading state
  if (checking) {
    return <LoadingScreen message="Verifying commission access permissions..." />;
  }

  // 2. Locked state
  if (isProtected && !isUnlocked) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 bg-[#FAF9F5] dark:bg-slate-950">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-[#CBCBCB]/70 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden animate-fadeIn">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#6D8196]/15 dark:from-[#6D8196]/10 to-transparent rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

          {/* Icon & Title */}
          <div className="text-center relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6D8196] via-[#5A6D81] to-[#3D4F61] text-white mx-auto flex items-center justify-center shadow-md mb-4">
              <Lock className="w-8 h-8 drop-shadow-xs" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-[#4A4A4A] dark:text-slate-300 border border-[#CBCBCB]/60 dark:border-slate-700 mb-2">
              <Coins className="w-3.5 h-3.5 text-[#6D8196]" />
              <span>Password Protected</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-[#4A4A4A] dark:text-white tracking-tight">
              {pageTitle} Access
            </h1>
            <p className="text-xs sm:text-sm text-[#737373] dark:text-slate-400 mt-2 font-medium leading-relaxed">
              This section contains sensitive financial and commission data. Enter the Commission Password configured by the Super Admin to proceed.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleVerify} className="mt-6 space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-bold text-[#4A4A4A] dark:text-slate-200 uppercase tracking-wider mb-2">
                Enter Password
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Commission access password"
                  required
                  className="w-full px-4 py-3 pr-11 bg-white dark:bg-slate-800 border border-[#CBCBCB] dark:border-slate-700 rounded-xl text-sm font-semibold text-[#4A4A4A] dark:text-slate-100 focus:outline-none focus:border-[#6D8196] focus:ring-2 focus:ring-[#6D8196]/20 transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-shake">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3 px-4 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-sm font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {verifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Password...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Unlock Access</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Back Link */}
          <div className="mt-6 pt-5 border-t border-[#CBCBCB]/40 dark:border-slate-800 flex items-center justify-center relative z-10">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Unlocked state: Render page children with optional lock button
  return (
    <div className="relative">
      {isProtected && isUnlocked && (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-0 flex justify-end">
          <button
            onClick={handleRelock}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-900 border border-[#CBCBCB]/70 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-900 transition shadow-2xs cursor-pointer"
            title="Lock this section immediately"
          >
            <Lock className="w-3 h-3 text-[#6D8196]" />
            <span>Lock Commission Access</span>
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
