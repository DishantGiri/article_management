"use client";

import { useSession, signOut } from "next-auth/react";

export default function PendingApprovalPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/20 to-violet-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 space-y-6 text-center transition-all duration-300 hover:shadow-amber-500/10 hover:border-amber-500/20">
        
        {/* Pending Icon */}
        <div className="w-16 h-16 bg-amber-100 border border-amber-200/50 rounded-2xl flex items-center justify-center shadow-md mx-auto transform transition duration-500 hover:scale-105 hover:rotate-3">
          <svg className="w-8 h-8 text-amber-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Pending Approval</h1>
          <p className="text-slate-500 text-sm font-medium">Account requires administrator activation</p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* User Info & Message */}
        <div className="space-y-4">
          {session?.user && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-left space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Registered Account</p>
              <p className="text-xs font-bold text-slate-800 truncate">{session.user.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{session.user.email}</p>
            </div>
          )}
          
          <p className="text-slate-600 text-xs leading-relaxed">
            Welcome to InventoryPro! Your account has been registered. 
            Before you can access the system, an administrator must verify and approve your registration and assign your role.
          </p>
          
          <p className="text-[11px] text-amber-700 bg-amber-50/50 border border-amber-100 rounded-lg p-2.5 font-medium">
            Please contact your project manager or administrator to expedite this process.
          </p>
        </div>

        {/* Sign Out Action */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out & Try Another Account</span>
          </button>
        </div>

      </div>
    </div>
  );
}
