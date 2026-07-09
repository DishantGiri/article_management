"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const error = searchParams.get("error");

  return (
    <div className="w-full max-w-md bg-white/70 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 space-y-6 text-center transition-all duration-300 hover:shadow-indigo-500/10 hover:border-indigo-500/20">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-left space-y-1">
          <p className="font-bold">Access Denied</p>
          <p className="leading-relaxed text-rose-600 font-medium">
            Please login with official mail.
          </p>
        </div>
      )}
      {/* Brand Logo/Header */}
      <div className="space-y-2">
        <div className="w-16 h-16 bg-[#0f172a] rounded-2xl flex items-center justify-center shadow-lg mx-auto transform transition duration-500 hover:scale-105 hover:rotate-3">
          <span className="text-white font-extrabold text-2xl">A</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Article Flow</h1>
        <p className="text-slate-500 text-sm font-medium">Enterprise Workflow Manager</p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Description */}
      <div className="space-y-1">
        <h2 className="text-base font-bold text-slate-800">Welcome Back</h2>
        <p className="text-slate-500 text-xs leading-relaxed">
          Sign in to manage sites, categories, product indexing, and article workflows.
        </p>
      </div>

      {/* Email Testing Login Form */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value;
          if (!email) return;
          setLoading(true);
          try {
            await signIn("credentials", { email, callbackUrl });
          } catch (e) {
            console.error(e);
            setLoading(false);
          }
        }}
        className="space-y-3"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="test@fishtailinfosolutions.com"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Sign in with Email (Test)"
          )}
        </button>
      </form>

      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">Or</span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      {/* Google Login Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm shadow-md transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer active:scale-98"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
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
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/* Footer Details */}
      <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
        Protected by corporate single sign-on
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-100 flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
        </div>
      }>
        <SignInContent />
      </Suspense>
    </div>
  );
}
